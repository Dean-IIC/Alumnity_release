import type { User } from "./auth";
import { db } from "./db";
import { audit } from "./desk";
import { isModerator } from "./roles";
import type { Result } from "./social";
import { PAGE_DEFAULTS, PAGE_LIMITS, pageDef, SITE_PAGES, type PageSlug, type SitePage } from "../site-pages";

/*
 * The college's own words on the public pages (the director's letter, the About and
 * Community pages' opening words, the committee): `site.pages`, changed from the college
 * desk. A page whose row is missing, or that can't be read just now, shows the words in
 * the code (lib/site-pages.ts), so the public pages never go blank.
 */

type Row = { slug: string; title: string; body: string; signer_name: string | null; signer_role: string | null; updated_at: number };

const toPage = (r: Row): SitePage => ({ slug: r.slug as PageSlug, title: r.title, body: r.body, signerName: r.signer_name, signerRole: r.signer_role });

/** A page's words: the college's, or the code's if there are none. */
export async function sitePage(slug: PageSlug): Promise<SitePage> {
  try {
    const row = await db().one<Row>("select * from site.pages where slug = ?", slug);
    if (row && row.body.trim()) return toPage(row);
  } catch (error) {
    console.error(`site page ${slug}: showing the words in the code:`, error);
  }
  return PAGE_DEFAULTS[slug];
}

/** Several pages at once. */
export async function sitePages<S extends PageSlug>(...slugs: S[]): Promise<Record<S, SitePage>> {
  const found = await Promise.all(slugs.map((s) => sitePage(s)));
  return Object.fromEntries(slugs.map((s, i) => [s, found[i]])) as Record<S, SitePage>;
}

export type DeskPage = SitePage & { where: string; kind: "letter" | "text" | "list"; updatedAt: number | null; editedBy: string | null };

/** Every page the desk may change, with when it last was. */
export async function deskPages(me: User): Promise<DeskPage[]> {
  if (!isModerator(me)) return [];
  const rows = await db().all<Row & { editor: string | null }>("select site.pages.*, users.name as editor from site.pages left join users on users.id = site.pages.updated_by");
  return SITE_PAGES.map((def) => {
    const row = rows.find((r) => r.slug === def.slug);
    return {
      ...(row ? toPage(row) : PAGE_DEFAULTS[def.slug]),
      title: def.title,
      where: def.where,
      kind: def.kind,
      updatedAt: row ? Number(row.updated_at) : null,
      editedBy: row?.editor ?? null
    };
  });
}

export async function savePage(me: User, slug: string, input: { body: string; signerName?: string; signerRole?: string }): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: "Only the college desk can do that." };
  const def = pageDef(slug);
  if (!def) return { ok: false, error: "There's no such page." };
  const body = input.body.replace(/\r\n?/g, "\n").trim().slice(0, PAGE_LIMITS.body);
  if (!body) return { ok: false, error: "Add the words for this page." };
  const letter = def.kind === "letter";
  const signerName = letter ? (input.signerName ?? "").trim().slice(0, PAGE_LIMITS.signer) || null : null;
  const signerRole = letter ? (input.signerRole ?? "").trim().slice(0, PAGE_LIMITS.signer) || null : null;
  if (letter && !signerName) return { ok: false, error: "Add who signed the letter." };
  await db().run(
    `insert into site.pages (slug, title, body, signer_name, signer_role, updated_at, updated_by) values (?, ?, ?, ?, ?, ?, ?)
     on conflict (slug) do update set body = excluded.body, signer_name = excluded.signer_name, signer_role = excluded.signer_role,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    def.slug,
    def.title,
    body,
    signerName,
    signerRole,
    Date.now(),
    me.id
  );
  await audit(me, "changed a page", `page ${def.slug}`, def.title);
  return { ok: true };
}
