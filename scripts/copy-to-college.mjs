// Copies Alumnity's data from the current (old) Supabase into the college's: logins (with
// their password hashes, so passwords don't change), every table in public, records and
// site, and the uploaded files. The old database is only read. The college's database is
// emptied first (it only holds what its setup put there).
//
//   node scripts/copy-to-college.mjs            dry run: counts only, changes nothing
//   node scripts/copy-to-college.mjs --write    copies
//
// Needs (names only; values come from the environment, never printed):
//   OLD_DATABASE_URL, OLD_SUPABASE_URL, OLD_SERVICE_KEY
//   NEW_DATABASE_URL (session pooler, port 5432), NEW_SUPABASE_URL, NEW_SERVICE_KEY
import postgres from "postgres";

const WRITE = process.argv.includes("--write");
const need = ["OLD_DATABASE_URL", "OLD_SUPABASE_URL", "OLD_SERVICE_KEY", "NEW_DATABASE_URL", "NEW_SUPABASE_URL", "NEW_SERVICE_KEY"];
for (const k of need) if (!process.env[k]) throw new Error(`missing ${k}`);
const SCHEMAS = ["public", "records", "site"];
// Not worth copying: login attempt counters, wiped every day anyway.
const SKIP = new Set(["public.throttle"]);
// Links that go round in a circle (an album's cover is one of its own photos): copied as
// empty first, then filled in once both sides are there.
const LATER = { "site.albums": ["cover_photo_id"] };

const from = postgres(process.env.OLD_DATABASE_URL, { prepare: false, max: 2, connect_timeout: 30 });
const to = postgres(process.env.NEW_DATABASE_URL, { prepare: false, max: 2, connect_timeout: 30 });

const q = (s, t) => `"${s}"."${t}"`;

async function tablesIn(sql) {
  return sql`select table_schema s, table_name t from information_schema.tables
             where table_type = 'BASE TABLE' and table_schema in ${sql(SCHEMAS)} order by 1, 2`;
}

/** Tables in an order where each comes after the tables it points to (foreign keys). */
async function inDependencyOrder(sql, tables) {
  // From pg_catalog: information_schema hides constraints on tables the role doesn't own.
  const fks = await sql`
    select n.nspname s, c.relname t, rn.nspname rs, r.relname rt
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
    join pg_class r on r.oid = k.confrelid join pg_namespace rn on rn.oid = r.relnamespace
    where k.contype = 'f' and n.nspname in ${sql(SCHEMAS)}`;
  const key = (x) => `${x.s}.${x.t}`;
  const deps = new Map(tables.map((x) => [key(x), new Set()]));
  // The circular links filled in later (LATER) don't decide the order.
  const later = new Set(["site.albums->site.photos"]);
  for (const f of fks)
    if (deps.has(`${f.rs}.${f.rt}`) && key(f) !== `${f.rs}.${f.rt}` && !later.has(`${key(f)}->${f.rs}.${f.rt}`)) deps.get(key(f))?.add(`${f.rs}.${f.rt}`);
  const done = [], seen = new Set();
  const visit = (k, path = new Set()) => {
    if (seen.has(k) || path.has(k)) return;
    path.add(k);
    for (const d of deps.get(k) ?? []) visit(d, path);
    seen.add(k);
    done.push(k);
  };
  for (const x of tables) visit(key(x));
  return done.map((k) => tables.find((x) => key(x) === k));
}

/** Copies rows of one table in batches; columns are matched by name. */
async function copyTable(s, t, columns) {
  const rows = await from.unsafe(`select ${columns.map((c) => `"${c}"`).join(", ")} from ${q(s, t)}`);
  if (!WRITE || rows.length === 0) return rows.length;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const later = LATER[`${s}.${t}`] ?? [];
    await to.unsafe(
      `insert into ${q(s, t)} (${columns.map((c) => `"${c}"`).join(", ")}) overriding system value
       select ${columns.map((c) => (later.includes(c) ? "null" : `"${c}"`)).join(", ")} from json_populate_recordset(null::${q(s, t)}, $1::text::json)`,
      [JSON.stringify(batch)]
    );
  }
  return rows.length;
}

async function commonColumns(s, t) {
  const cols = (sql) => sql`select column_name c from information_schema.columns where table_schema = ${s} and table_name = ${t} and is_generated = 'NEVER'`;
  const [a, b] = await Promise.all([cols(from), cols(to)]);
  const there = new Set(b.map((r) => r.c));
  return a.map((r) => r.c).filter((c) => there.has(c));
}

async function main() {
  console.log(WRITE ? "COPYING (old database is only read)" : "DRY RUN (nothing changes)");

  // 1. Logins, first: members point at them.
  for (const t of ["users", "identities"]) {
    const cols = await commonColumns("auth", t);
    const [{ n }] = await from.unsafe(`select count(*)::int n from auth.${t}`);
    console.log(`auth.${t}: ${n}`);
    if (WRITE) {
      const rows = await from.unsafe(`select ${cols.map((c) => `"${c}"`).join(", ")} from auth."${t}"`);
      await to.unsafe(
        `insert into auth."${t}" (${cols.map((c) => `"${c}"`).join(", ")})
         select ${cols.map((c) => `"${c}"`).join(", ")} from json_populate_recordset(null::auth."${t}", $1::text::json) on conflict do nothing`,
        [JSON.stringify(rows)]
      );
    }
  }

  // 2. The college's tables emptied (only its setup's rows are there), then filled in order.
  const tables = (await tablesIn(from)).filter((x) => !SKIP.has(`${x.s}.${x.t}`));
  const targetTables = await tablesIn(to);
  const targetSet = new Set(targetTables.map((x) => `${x.s}.${x.t}`));
  const ordered = await inDependencyOrder(from, tables.filter((x) => targetSet.has(`${x.s}.${x.t}`)));
  if (WRITE) await to.unsafe(`truncate ${targetTables.map((x) => q(x.s, x.t)).join(", ")} restart identity cascade`);
  let total = 0;
  for (const { s, t } of ordered) {
    const cols = await commonColumns(s, t);
    const n = await copyTable(s, t, cols);
    total += n;
    if (n) console.log(`${s}.${t}: ${n}`);
  }
  console.log(`rows: ${total} in ${ordered.length} tables`);

  // The circular links, now that both sides exist.
  if (WRITE) {
    for (const [table, cols] of Object.entries(LATER)) {
      const [s, t] = table.split(".");
      for (const c of cols) {
        const rows = await from.unsafe(`select id, "${c}" v from ${q(s, t)} where "${c}" is not null`);
        if (rows.length)
          await to.unsafe(`update ${q(s, t)} x set "${c}" = r.v from json_to_recordset($1::text::json) as r(id bigint, v bigint) where x.id = r.id`, [JSON.stringify(rows)]);
        console.log(`${table}.${c}: ${rows.length} filled in`);
      }
    }
  }

  // 3. Identity counters continue after the copied ids.
  if (WRITE) {
    const ids = await to`select table_schema s, table_name t, column_name c from information_schema.columns
                         where is_identity = 'YES' and table_schema in ${to(SCHEMAS)}`;
    for (const { s, t, c } of ids) {
      await to.unsafe(`select setval(pg_get_serial_sequence('${q(s, t)}', '${c}'), greatest(coalesce((select max("${c}") from ${q(s, t)}), 0), 1), (select count(*) > 0 from ${q(s, t)}))`);
    }
    console.log(`identity counters: ${ids.length} set`);
  }

  // 4. Uploaded files, through each project's storage API.
  const objects = await from`select bucket_id, name, metadata->>'mimetype' as type from storage.objects order by 1, 2`;
  console.log(`files: ${objects.length}`);
  if (WRITE) {
    let ok = 0;
    for (const o of objects) {
      const path = o.name.split("/").map(encodeURIComponent).join("/");
      const got = await fetch(`${process.env.OLD_SUPABASE_URL}/storage/v1/object/${o.bucket_id}/${path}`, { headers: { Authorization: `Bearer ${process.env.OLD_SERVICE_KEY}`, apikey: process.env.OLD_SERVICE_KEY } });
      if (!got.ok) { console.log(`  could not read ${o.bucket_id}/${o.name}: ${got.status}`); continue; }
      const put = await fetch(`${process.env.NEW_SUPABASE_URL}/storage/v1/object/${o.bucket_id}/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NEW_SERVICE_KEY}`, apikey: process.env.NEW_SERVICE_KEY, "content-type": o.type || "application/octet-stream", "x-upsert": "true" },
        body: Buffer.from(await got.arrayBuffer())
      });
      if (put.ok) ok++;
      else console.log(`  could not write ${o.bucket_id}/${o.name}: ${put.status}`);
    }
    console.log(`files copied: ${ok} of ${objects.length}`);
  }

  // 5. The two sides compared.
  if (WRITE) {
    let mismatch = 0;
    for (const { s, t } of ordered) {
      const [[{ a }], [{ b }]] = await Promise.all([from.unsafe(`select count(*)::int a from ${q(s, t)}`), to.unsafe(`select count(*)::int b from ${q(s, t)}`)]);
      if (a !== b) { mismatch++; console.log(`  differs: ${s}.${t} old ${a}, college ${b}`); }
    }
    const [[{ a }], [{ b }]] = await Promise.all([from`select count(*)::int a from auth.users`, to`select count(*)::int b from auth.users`]);
    console.log(`check: ${mismatch} tables differ; logins old ${a}, college ${b}`);
  }
  await from.end();
  await to.end();
}

main().catch(async (e) => {
  console.log("stopped:", String(e.message).slice(0, 300));
  await from.end({ timeout: 1 });
  await to.end({ timeout: 1 });
  process.exit(1);
});
