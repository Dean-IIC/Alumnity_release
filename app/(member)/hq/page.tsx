import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "../../../components/app/app-page";
import { Database, ImportExport, Mail, Members, Register } from "../../../components/hq/sections";
import { REGISTER_BRANCHES } from "../../../lib/server/hq";
import { isSuperAdmin } from "../../../lib/server/roles";
import { currentUser } from "../../../lib/server/session";
import "../../styles/hq.css";

// Named only for a super administrator: anyone else sees a page that isn't here.
export async function generateMetadata(): Promise<Metadata> {
  const me = await currentUser();
  if (!me || !isSuperAdmin(me)) notFound();
  return { title: "HQ · Alumnity", robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";
// A batch of emails takes a while.
export const maxDuration = 60;

type Tab = "register" | "files" | "members" | "mail" | "database";
const TABS: [Tab, string][] = [
  ["register", "Register"],
  ["files", "Import & export"],
  ["members", "Members"],
  ["mail", "Mass email"],
  ["database", "Database"]
];

/**
 * HQ: the super administrator's back office, plain on purpose. Not linked anywhere, and
 * "not found" for everyone else (signed out too), so nobody learns it's here.
 */
export default async function HqPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; branch?: string; year?: string; page?: string; edit?: string }> }) {
  const me = await currentUser();
  if (!me || !isSuperAdmin(me)) notFound();
  const p = await searchParams;
  const tab: Tab = TABS.some(([t]) => t === p.tab) ? (p.tab as Tab) : "register";
  const q = (p.q ?? "").slice(0, 100);
  const year = Number(p.year);
  const edit = Number(p.edit) > 0 ? Math.floor(Number(p.edit)) : undefined;
  return (
    <AppPage user={me} current="desk" title="HQ" intro="The register and the database, for super administrators. Everything you do here goes in the audit log.">
      <nav className="wf-tabs" aria-label="HQ sections">
        {TABS.map(([t, label]) => (
          <Link key={t} href={`/hq?tab=${t}`} aria-current={t === tab ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "register" && (
        <Register
          me={me}
          query={{
            q,
            branch: REGISTER_BRANCHES.some(([c]) => c === p.branch) ? p.branch : undefined,
            year: Number.isInteger(year) && year > 1900 ? year : undefined,
            page: Math.max(1, Math.floor(Number(p.page) || 1))
          }}
          edit={edit}
        />
      )}
      {tab === "files" && <ImportExport />}
      {tab === "members" && <Members me={me} q={q} edit={edit} />}
      {tab === "mail" && <Mail me={me} />}
      {tab === "database" && <Database me={me} />}
    </AppPage>
  );
}
