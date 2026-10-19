import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "../../../components/app/app-page";
import { Announcements, Audit, Content, Members, Overview, Reports, SiteSettings, Team } from "../../../components/desk/sections";
import { isBranch } from "../../../lib/branches";
import { ROLE_LABEL } from "../../../lib/format";
import { isAdmin, isModerator } from "../../../lib/server/roles";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "College desk · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

type Tab = "overview" | "reports" | "content" | "members" | "announcements" | "team" | "settings" | "audit";
type Params = { tab?: string; q?: string; closed?: string; kind?: string; role?: string; status?: string; branch?: string };

/** The college desk: what each role may do, in one place. Not found for everyone else. */
export default async function DeskPage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireUser("/desk");
  if (!isModerator(me)) notFound();
  const p = await searchParams;
  const q = (p.q ?? "").slice(0, 100);
  const tabs: [Tab, string][] = [
    ["overview", "Overview"],
    ["reports", "Reports"],
    ["content", "Content"],
    ["members", "Members"],
    ["announcements", "Announcements"],
    ["team", "Team"],
    ["settings", "Settings"],
    ...(isAdmin(me) ? ([["audit", "Audit log"]] as [Tab, string][]) : [])
  ];
  const tab: Tab = tabs.some(([t]) => t === p.tab) ? (p.tab as Tab) : "overview";
  const kind = p.kind === "comment" || p.kind === "ask" ? p.kind : "post";

  return (
    <AppPage user={me} current="desk" title="College desk" intro={`Logged in as ${ROLE_LABEL[me.role].toLowerCase()}. Everything done here is written to the audit log.`}>
      <nav className="wf-tabs" aria-label="Desk sections">
        {tabs.map(([t, label]) => (
          <Link key={t} href={`/desk?tab=${t}`} aria-current={t === tab ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "overview" && <Overview me={me} />}
      {tab === "reports" && <Reports me={me} closed={p.closed === "1"} />}
      {tab === "content" && <Content me={me} kind={kind} q={q} />}
      {tab === "members" && (
        <Members
          me={me}
          filter={{
            q,
            role: p.role && p.role in ROLE_LABEL ? p.role : undefined,
            status: p.status === "active" || p.status === "paused" ? p.status : "",
            branch: isBranch(p.branch) ? p.branch : undefined
          }}
        />
      )}
      {tab === "announcements" && <Announcements me={me} />}
      {tab === "team" && <Team me={me} />}
      {tab === "settings" && <SiteSettings me={me} />}
      {tab === "audit" && isAdmin(me) && <Audit me={me} q={q} />}
    </AppPage>
  );
}
