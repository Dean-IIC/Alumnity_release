// Loads the college register (a CSV: name,usn,branch,branch_name,programme,year) into the
// database's `register` table, replacing what's there. The CSV is never committed: keep it
// on the computer that runs this.
//
//   DATABASE_URL=postgres://… node scripts/import-register.mjs data/college-records.csv
//
// Use the database's direct or session connection string (port 5432), not the pooler's
// transaction mode. It runs in one transaction: all of it goes in, or none of it.

import { readFileSync } from "node:fs";
import postgres from "postgres";
import { parseRegister } from "../lib/register.ts";

const file = process.argv[2] || "data/college-records.csv";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to the Supabase database's connection string (see docs/deploy.md).");
  process.exit(1);
}

const rows = parseRegister(readFileSync(file, "utf8")).filter((r) => r.name && r.usn && r.branch && Number.isInteger(r.year));
if (!rows.length) {
  console.error(`No register lines found in ${file}.`);
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx`delete from register`;
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000).map((r) => ({ name: r.name, usn: r.usn, branch: r.branch, branch_name: r.branchName, programme: r.programme, year: r.year }));
      await tx`insert into register ${tx(batch, "name", "usn", "branch", "branch_name", "programme", "year")}`;
    }
  });
  const years = rows.map((r) => r.year);
  console.log(`Loaded ${rows.length} register lines (${Math.min(...years)}–${Math.max(...years)}).`);
} finally {
  await sql.end();
}
