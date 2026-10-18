import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { createOpeningAction } from "../../../lib/actions/openings";
import { BRANCHES } from "../../../lib/branches";
import { timeAgo } from "../../../lib/format";
import { canPostOpening, OPEN_FOR, OPENING_LIMITS, openingsFor, type Opening } from "../../../lib/server/openings";
import { settings } from "../../../lib/server/settings";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Jobs & referrals · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND = { job: "Job", internship: "Internship" } as const;
const branchName = (code: string | null) => (code ? (BRANCHES.find(([c]) => c === code)?.[1] ?? code) : "Any branch");
const closes = (at: number) => new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function OpeningLine({ opening: o, showRequests = false }: { opening: Opening; showRequests?: boolean }) {
  return (
    <li className="wf-member">
      <div className="wf-member__who">
        <Link className="wf-member__name" href={`/openings/${o.id}`}>
          {o.title}
        </Link>
        <span className="wf-muted">
          {o.company}
          {o.place ? ` · ${o.place}` : ""}
        </span>
        <span className="wf-member__detail">
          {KIND[o.kind]} · {branchName(o.branch)}
          {o.poster && !o.mine ? ` · from ${o.poster.name}` : ""} · {o.closed ? "closed" : `open till ${closes(o.closesAt)}`}
        </span>
      </div>
      <div className="wf-actions">
        {showRequests && <span className="wf-tag">{o.requests === 1 ? "1 asked" : `${o.requests} asked`}</span>}
        {!showRequests && o.myRequest && <span className={`wf-tag ${o.myRequest.accepted ? "wf-tag--ok" : "wf-tag--waiting"}`}>{o.myRequest.accepted ? "They said yes" : "You asked"}</span>}
        {!showRequests && !o.myRequest && o.canRefer && <span className="wf-tag wf-tag--ok">Can refer</span>}
      </div>
    </li>
  );
}

/** Openings alumni and staff put up, narrowed by kind or branch; theirs; and (for them) a form to add one. */
export default async function OpeningsPage({ searchParams }: { searchParams: Promise<{ kind?: string; branch?: string; new?: string }> }) {
  const p = await searchParams;
  const me = await requireUser("/openings");
  const branch = p.branch === undefined ? (me.role === "student" ? (me.branch ?? "") : "") : p.branch;
  const { open, mine } = await openingsFor(me, { kind: p.kind, branch });
  const canPost = canPostOpening(me) && (await settings()).features.openings;
  const filtered = Boolean(p.kind || branch);

  return (
    <AppPage
      user={me}
      current="openings"
      title="Jobs & referrals"
      intro="Openings HKBK alumni and staff know about, often where they work. Ask the person who put one up to refer you: write a line about why you fit."
    >
      <form className="wf-filters wf-filters--short" role="search" action="/openings">
        <label className="field">
          <span className="field__label">Kind</span>
          <select name="kind" defaultValue={p.kind ?? ""}>
            <option value="">Jobs and internships</option>
            <option value="job">Jobs</option>
            <option value="internship">Internships</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Branch</span>
          <select name="branch" defaultValue={branch}>
            <option value="">Any branch</option>
            {BRANCHES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--secondary" type="submit">
          Show
        </button>
      </form>

      <h2>Open now</h2>
      {open.length === 0 ? (
        <p className="wf-empty">
          {filtered ? "Nothing open for that just now. " : "Nothing open yet. "}
          {canPost ? "Know of a role at your company? Put it up below: a student from HKBK could be the right person." : "Alumni put openings up here. When one fits you, you can ask them for a referral."}
          {filtered && (
            <>
              {" "}
              <Link className="wf-inline-link" href="/openings?branch=">
                See every opening
              </Link>
            </>
          )}
        </p>
      ) : (
        <ul className="wf-list">
          {open.map((o) => (
            <OpeningLine key={o.id} opening={o} />
          ))}
        </ul>
      )}

      {canPost && (
        <details className="wf-fold" id="new-opening" open={p.new === "1"}>
          <summary>Put up an opening</summary>
          <ActionForm action={createOpeningAction} className="wf-stack">
            <div className="field-row">
              <label className="field">
                <span className="field__label">Kind</span>
                <select name="kind" defaultValue="job">
                  <option value="job">Job</option>
                  <option value="internship">Internship</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Suits which branch</span>
                <select name="branch" defaultValue="">
                  <option value="">Any branch</option>
                  {BRANCHES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="field__label">The role</span>
              <input name="title" required maxLength={OPENING_LIMITS.title} placeholder="e.g. Graduate engineer trainee" />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Company</span>
                <input name="company" required maxLength={OPENING_LIMITS.company} placeholder="e.g. Bosch" />
              </label>
              <label className="field">
                <span className="field__label">Where (optional)</span>
                <input name="place" maxLength={OPENING_LIMITS.place} placeholder="e.g. Bengaluru, or Remote" />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Link to apply (optional)</span>
              <input name="link" type="url" maxLength={OPENING_LIMITS.link} placeholder="https://" />
            </label>
            <label className="field">
              <span className="field__label">What they're looking for</span>
              <textarea name="body" rows={4} maxLength={OPENING_LIMITS.body} placeholder="Skills, the year they should graduate, anything that helps someone decide." />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Stays up for</span>
                <select name="days" defaultValue="30">
                  {OPEN_FOR.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </label>
              <label className="wf-check">
                <input type="checkbox" name="canRefer" defaultChecked /> I can refer people for it
              </label>
            </div>
            <div>
              <button className="button button--primary" type="submit">
                Put it up
              </button>
            </div>
          </ActionForm>
        </details>
      )}

      {mine.length > 0 && (
        <>
          <h2>Yours</h2>
          <ul className="wf-list">
            {mine.map((o) => (
              <OpeningLine key={o.id} opening={o} showRequests />
            ))}
          </ul>
        </>
      )}
    </AppPage>
  );
}
