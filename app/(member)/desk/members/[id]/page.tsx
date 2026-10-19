import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../../../components/app/action-form";
import { AppPage } from "../../../../../components/app/app-page";
import { deleteMemberAction, pauseAction, roleAction, signOutAction } from "../../../../../lib/actions/desk";
import { batchLabel, ROLE_LABEL, timeAgo, when } from "../../../../../lib/format";
import { memberDetail } from "../../../../../lib/server/desk";
import { assignable, isAdmin, isModerator, isSuperAdmin, outranks } from "../../../../../lib/server/roles";
import { requireUser } from "../../../../../lib/server/session";

export const metadata: Metadata = { title: "A member · College desk", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One member, for the desk: who they are, what they've done, and what you may do about it. */
export default async function DeskMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/desk/members/${raw}`);
  if (!isModerator(me)) notFound();
  const id = Number(raw);
  const m = Number.isSafeInteger(id) && id > 0 ? await memberDetail(me, id) : null;
  if (!m) notFound();
  const self = m.id === me.id;
  const above = outranks(me, m);
  const roles = assignable(me);
  const hidden = <input type="hidden" name="id" value={m.id} />;

  return (
    <AppPage user={me} current="desk" back={{ href: "/desk?tab=members", label: "Members" }} title={m.name}>
      <section className="wf-card">
        <p>
          <strong>Email:</strong> {m.email}
          <br />
          <strong>Batch:</strong> {batchLabel(m) || "—"} {m.programme ? `· ${m.programme}` : ""}
          <br />
          <strong>Role:</strong> {ROLE_LABEL[m.role]}
          {m.configRole ? " (set by the site's technical team)" : ""}
          <br />
          <strong>Status:</strong> {m.suspended ? "Paused" : "Active"}
          {m.sample ? " · sample member" : ""}
          <br />
          <strong>Joined Alumnity:</strong> {when(m.createdAt)}
          <br />
          <strong>Logged in on:</strong> {m.sessions.count} device{m.sessions.count === 1 ? "" : "s"}
          {m.sessions.lastSignIn ? ` · last login ${timeAgo(m.sessions.lastSignIn)}` : ""}
        </p>
        <div className="wf-actions">
          <span className="wf-tag">{m.counts.connections} connections</span>
          <span className="wf-tag">{m.counts.notes} posts</span>
          <span className="wf-tag">{m.counts.asks} questions asked</span>
          <span className="wf-tag">{m.counts.answered} questions answered</span>
          <span className={`wf-tag ${m.counts.reportsAbout ? "wf-tag--red" : ""}`}>{m.counts.reportsAbout} reports about them</span>
          <span className="wf-tag">{m.counts.reportsMade} reports made</span>
        </div>
        {!m.suspended && (
          <p style={{ marginTop: "var(--space-3)" }}>
            <Link href={`/people/${m.id}`}>See their page as members see it →</Link>
          </p>
        )}
      </section>

      {self ? (
        <p className="wf-muted">This is you. Use Settings to change your own account.</p>
      ) : !above ? (
        <p className="wf-card">They're at your level or above on the college desk, so you can't change anything here.</p>
      ) : (
        <>
          <h2>Access</h2>
          <div className="wf-actions">
            <ActionForm action={pauseAction} confirm={m.suspended ? undefined : `Pause ${m.name}? They will be logged out on all devices and hidden from everyone until you unpause them.`}>
              {hidden}
              <input type="hidden" name="paused" value={m.suspended ? "0" : "1"} />
              <button className={`button wf-small ${m.suspended ? "button--primary" : "button--secondary"}`} type="submit">
                {m.suspended ? "Unpause" : "Pause"}
              </button>
            </ActionForm>
            <ActionForm action={signOutAction} confirm={`Log ${m.name} out on every device?`}>
              {hidden}
              <button className="button button--secondary wf-small" type="submit" disabled={m.sessions.count === 0}>
                Log out everywhere
              </button>
            </ActionForm>
          </div>

          {isAdmin(me) && !m.configRole && (
            <>
              <h2>Role</h2>
              <ActionForm action={roleAction} className="wf-actions">
                {hidden}
                <label className="field" style={{ margin: 0 }}>
                  <span className="field__label">Role</span>
                  <select name="role" defaultValue={m.role}>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button--secondary wf-small" type="submit">
                  Set role
                </button>
              </ActionForm>
              <p className="wf-muted">
                {isSuperAdmin(me) ? "You can make administrators." : "Only a super administrator can make administrators."} We tell them when their role changes.
              </p>
            </>
          )}

          {isSuperAdmin(me) && (
            <>
              <h2>Delete permanently</h2>
              <details className="wf-card">
                <summary>Delete {m.name} and everything they posted</summary>
                <ActionForm action={deleteMemberAction} className="wf-stack">
                  {hidden}
                  <p className="wf-note wf-note--error">
                    This can't be undone. Their page, posts, comments, messages, questions and connections will all be deleted. Pausing the account is usually enough.
                  </p>
                  <label className="field">
                    <span className="field__label">Type their name to confirm: {m.name}</span>
                    <input name="confirm" autoComplete="off" required />
                  </label>
                  <div>
                    <button className="button button--primary wf-small" type="submit">
                      Delete permanently
                    </button>
                  </div>
                </ActionForm>
              </details>
            </>
          )}
        </>
      )}

      {m.recentAudit.length > 0 && (
        <>
          <h2>History</h2>
          <ul className="wf-list">
            {m.recentAudit.map((e) => (
              <li key={e.id} className="wf-member">
                <span>
                  {e.actor} · {e.action}
                  {e.detail ? ` · ${e.detail}` : ""}
                </span>
                <span className="wf-muted">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppPage>
  );
}
