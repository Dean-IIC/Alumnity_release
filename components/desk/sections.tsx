import Link from "next/link";
import { ActionForm } from "../app/action-form";
import { announceAction, inviteStaffAction, removeAnnouncementAction, resolveReportAction, restoreAction, revokeInviteAction, settingsAction, takeDownAction } from "../../lib/actions/desk";
import { BRANCHES } from "../../lib/branches";
import { batchLabel, capital, ROLE_LABEL, rupees, timeAgo, when } from "../../lib/format";
import type { User } from "../../lib/server/auth";
import { allAnnouncements } from "../../lib/server/announcements";
import { auditLog, deskMembers, deskSettings, recentContent, reports, stats, team, type ContentKind, type MemberFilter, type SubjectKind } from "../../lib/server/desk";
import { assignable, isAdmin, isSuperAdmin } from "../../lib/server/roles";
import { invites, STAFF_ROLES } from "../../lib/server/staff";
import { FEATURE_LABEL } from "../../lib/server/settings";

/* The college desk's sections. Each checks the viewer's role again on the server (lib/server/desk.ts). */

export async function Overview({ me }: { me: User }) {
  const s = await stats(me);
  if (!s) return null;
  const peak = Math.max(1, ...s.joinsByWeek);
  const items: [string, number, string?][] = [
    ["Members", s.members],
    ["Joined this week", s.joinedThisWeek],
    ["Logged in this week", s.signedInThisWeek],
    ["Alumni", s.alumni],
    ["Students", s.students],
    ["Mentors", s.mentors],
    ["Connections", s.connections],
    ["Questions", s.asks],
    ["Questions answered", s.answered],
    ["Posts", s.posts],
    ["Events", s.events],
    ["Groups", s.groups],
    ["Open reports", s.openReports, "/desk?tab=reports"],
    ["Causes to check", s.causesWaiting, "/causes"],
    ["Paused", s.paused, "/desk?tab=members&status=paused"]
  ];
  // First, what's waiting for the desk; then the numbers.
  const waiting = [
    s.openReports > 0 && { href: "/desk?tab=reports", text: `${s.openReports} report${s.openReports === 1 ? "" : "s"} to check` },
    s.causesWaiting > 0 && { href: "/causes", text: `${s.causesWaiting} cause${s.causesWaiting === 1 ? "" : "s"} to check` }
  ].filter(Boolean) as { href: string; text: string }[];
  return (
    <>
      <section className={`wf-card desk-waiting ${waiting.length ? "" : "desk-waiting--clear"}`} aria-labelledby="desk-waiting">
        <h2 id="desk-waiting">{waiting.length ? "Waiting for the desk" : "Nothing waiting for the desk"}</h2>
        {waiting.length ? (
          <ul>
            {waiting.map((w) => (
              <li key={w.href}>
                <a href={w.href}>{w.text} →</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wf-muted">No reports or causes to check. You can invite staff in the Team tab, or post in the Announcements tab.</p>
        )}
      </section>
      <div className="wf-grid">
        {items.map(([label, n, href]) => (
          <div key={label} className="wf-stat">
            <strong>{n.toLocaleString("en-IN")}</strong>
            {href ? <a href={href}>{label}</a> : label}
          </div>
        ))}
      </div>
      <h2>New members, last 8 weeks</h2>
      <div className="wf-bars" role="img" aria-label={`New members per week: ${s.joinsByWeek.join(", ")}`}>
        {s.joinsByWeek.map((n, i) => (
          <div key={i} className="wf-bars__bar" style={{ height: `${Math.max(4, (n / peak) * 100)}%` }}>
            <span>{n}</span>
          </div>
        ))}
      </div>
      <p className="wf-muted">These are totals only. No names are shown.</p>
      <h2>Causes</h2>
      <p>
        {rupees(s.raised)} given to causes so far. <Link className="wf-inline-link" href="/causes">
          See the causes
        </Link>
        {isAdmin(me) && (
          <>
            {" · "}
            <a className="wf-inline-link" href="/desk/donations.csv" download>
              Download all donations (CSV, for the accounts office)
            </a>
          </>
        )}
      </p>
    </>
  );
}

/** Display names for what was reported (the stored kinds stay as they are). */
const REPORT_KIND: Record<SubjectKind, string> = { member: "Member", post: "Post", comment: "Comment", message: "Message", ask: "Question", group: "Group", cause: "Cause" };

export async function Reports({ me, closed }: { me: User; closed: boolean }) {
  const list = await reports(me, closed ? "closed" : "open");
  return (
    <>
      <p>
        <a className="wf-link-button" href={closed ? "/desk?tab=reports" : "/desk?tab=reports&closed=1"}>
          {closed ? "← Open reports" : "Closed reports →"}
        </a>
      </p>
      {list.length === 0 && <p className="wf-empty">{closed ? "No closed reports yet." : "No open reports."}</p>}
      {list.map((r) => (
        <article key={r.id} className="wf-card">
          <div className="wf-card__meta">
            <span className="wf-tag">{REPORT_KIND[r.kind] ?? r.kind}</span>
            <span>Reported {timeAgo(r.createdAt)}</span>
            {r.status !== "open" && <span className="wf-tag">{r.status === "dismissed" ? "Dismissed" : r.kind === "member" ? "Paused" : r.kind === "cause" ? "Closed" : "Taken down"}</span>}
          </div>
          <p>
            <strong>Why:</strong> {r.reason}
          </p>
          {r.subject ? (
            <p>
              <strong>{r.kind === "member" ? "Member" : "What was written"}:</strong>{" "}
              {r.kind === "member" && r.subject.owner ? <Link href={`/desk/members/${r.subject.owner.id}`}>{r.subject.text}</Link> : r.subject.text}
              {r.subject.owner && r.kind !== "member" && (
                <>
                  <br />
                  <span className="wf-muted">
                    By <Link href={`/desk/members/${r.subject.owner.id}`}>{r.subject.owner.name}</Link>
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="wf-muted">This has already been deleted.</p>
          )}
          {r.status === "open" && (
            <div className="wf-actions">
              <ActionForm action={resolveReportAction} confirm={r.kind === "member" ? "Pause this member? They will be logged out and hidden until you unpause them." : "Take this down?"}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="action" value="remove" />
                <button className="button button--primary wf-small" type="submit">
                  {r.kind === "member" ? "Pause the member" : "Take it down"}
                </button>
              </ActionForm>
              <ActionForm action={resolveReportAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="action" value="dismiss" />
                <button className="button button--secondary wf-small" type="submit">
                  Dismiss
                </button>
              </ActionForm>
            </div>
          )}
        </article>
      ))}
    </>
  );
}

const CONTENT_TABS: [ContentKind, string][] = [
  ["post", "Posts"],
  ["comment", "Comments"],
  ["ask", "Questions"]
];

export async function Content({ me, kind, q }: { me: User; kind: ContentKind; q: string }) {
  const list = await recentContent(me, kind, q);
  const admin = isAdmin(me);
  return (
    <>
      <div className="wf-tabs">
        {CONTENT_TABS.map(([k, label]) => (
          <Link key={k} href={`/desk?tab=content&kind=${k}`} aria-current={k === kind ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </div>
      <form action="/desk" className="wf-actions" role="search">
        <input type="hidden" name="tab" value="content" />
        <input type="hidden" name="kind" value={kind} />
        <label className="field" style={{ flex: 1, margin: 0 }}>
          <span className="field__label">Search for</span>
          <input name="q" defaultValue={q} maxLength={100} />
        </label>
        <button className="button button--primary wf-small" type="submit">
          Search
        </button>
      </form>
      {list.length === 0 && <p className="wf-empty">Nothing here.</p>}
      {list.map((c) => (
        <article key={`${c.kind}-${c.id}`} className="wf-card">
          <div className="wf-card__meta">
            {c.author && <Link href={`/desk/members/${c.author.id}`}>{c.author.name}</Link>}
            <span>{timeAgo(c.createdAt)}</span>
            {c.removed && <span className="wf-tag wf-tag--red">{c.kind === "ask" ? "Closed" : "Taken down"}</span>}
          </div>
          <p>{c.text}</p>
          <div className="wf-actions">
            {!c.removed ? (
              <ActionForm action={takeDownAction} confirm="Take this down? We will tell the author it broke the community rules.">
                <input type="hidden" name="kind" value={c.kind} />
                <input type="hidden" name="id" value={c.id} />
                <button className="button button--secondary wf-small" type="submit">
                  Take down
                </button>
              </ActionForm>
            ) : (
              admin &&
              c.kind !== "ask" && (
                <ActionForm action={restoreAction}>
                  <input type="hidden" name="kind" value={c.kind} />
                  <input type="hidden" name="id" value={c.id} />
                  <button className="button button--secondary wf-small" type="submit">
                    Restore
                  </button>
                </ActionForm>
              )
            )}
          </div>
        </article>
      ))}
    </>
  );
}

export async function Members({ me, filter }: { me: User; filter: MemberFilter }) {
  const list = await deskMembers(me, filter);
  return (
    <>
      <form action="/desk" className="wf-filters" role="search">
        <input type="hidden" name="tab" value="members" />
        <label className="field">
          <span className="field__label">Name or email</span>
          <input name="q" defaultValue={filter.q} maxLength={100} />
        </label>
        <label className="field">
          <span className="field__label">Role</span>
          <select name="role" defaultValue={filter.role ?? ""}>
            <option value="">Any</option>
            {Object.entries(ROLE_LABEL).map(([r, label]) => (
              <option key={r} value={r}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Status</span>
          <select name="status" defaultValue={filter.status ?? ""}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Branch</span>
          <select name="branch" defaultValue={filter.branch ?? ""}>
            <option value="">Any</option>
            {BRANCHES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--primary wf-small" type="submit">
          Filter
        </button>
      </form>
      <ul className="wf-list">
        {list.map((u) => (
          <li key={u.id} className="wf-member">
            <div className="wf-member__who">
              <Link className="wf-member__name" href={`/desk/members/${u.id}`}>
                {u.name}
              </Link>
              <span className="wf-muted">
                {[u.email, batchLabel(u), ROLE_LABEL[u.role], `joined ${timeAgo(u.createdAt)}`].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="wf-actions">
              {u.suspended && <span className="wf-tag wf-tag--red">Paused</span>}
              {u.sample && <span className="wf-tag">Sample</span>}
              <Link className="button button--secondary wf-small" href={`/desk/members/${u.id}`}>
                Manage
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="wf-empty">No members match.</p>}
    </>
  );
}

export async function Announcements({ me }: { me: User }) {
  const list = await allAnnouncements(me);
  return (
    <>
      <ActionForm action={announceAction} resetOnSuccess className="wf-stack">
        <label className="field">
          <span className="field__label">Title</span>
          <input name="title" required maxLength={120} placeholder="e.g. Alumni Day is on 14 December" />
        </label>
        <label className="field">
          <span className="field__label">Message</span>
          <textarea name="body" rows={3} required maxLength={1000} />
        </label>
        <label className="field">
          <span className="field__label">Show for</span>
          <select name="days" defaultValue="14">
            <option value="3">Three days</option>
            <option value="7">A week</option>
            <option value="14">Two weeks</option>
            <option value="30">A month</option>
            <option value="0">Until it's taken down</option>
          </select>
        </label>
        <div>
          <button className="button button--primary" type="submit">
            Post announcement
          </button>
        </div>
      </ActionForm>
      <h2>Announcements</h2>
      {list.length === 0 && <p className="wf-empty">None yet.</p>}
      {list.map((a) => {
        const live = !a.removed && (!a.endsAt || a.endsAt > Date.now());
        return (
          <article key={a.id} className="wf-card">
            <div className="wf-card__meta">
              <span className={`wf-tag ${live ? "" : "wf-tag--red"}`}>{a.removed ? "Taken down" : live ? "Showing" : "Ended"}</span>
              <span>
                {a.author ?? "—"} · {timeAgo(a.createdAt)}
                {a.endsAt ? ` · until ${when(a.endsAt)}` : ""}
              </span>
            </div>
            <p>
              <strong>{a.title}</strong>
              <br />
              {a.body}
            </p>
            {live && (
              <ActionForm action={removeAnnouncementAction}>
                <input type="hidden" name="id" value={a.id} />
                <button className="wf-link-button" type="submit">
                  Take it down
                </button>
              </ActionForm>
            )}
          </article>
        );
      })}
    </>
  );
}

export async function Team({ me }: { me: User }) {
  const [list, pending] = await Promise.all([team(me), invites(me)]);
  const roles = STAFF_ROLES.filter((r) => assignable(me).includes(r));
  return (
    <>
      <div className="wf-prose wf-muted">
        <ul>
          <li>Only the site's technical team can set super administrators. You can't change them here.</li>
          <li>A super administrator can make someone an administrator.</li>
          <li>An administrator can make someone a coordinator.</li>
          <li>Someone already on Alumnity? Open their name in Members to give them a role.</li>
        </ul>
      </div>
      {roles.length > 0 && (
        <section className="wf-card" aria-labelledby="invite-staff">
          <h2 id="invite-staff">Invite staff</h2>
          <p className="wf-muted">Teachers and college staff aren't in the college register. They join by invitation:</p>
          <div className="wf-prose wf-muted">
            <ol>
              <li>They get an email with a link.</li>
              <li>They check their email with a code.</li>
              <li>They choose a password.</li>
            </ol>
          </div>
          <ActionForm action={inviteStaffAction} className="wf-stack" resetOnSuccess>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Their name</span>
                <input name="name" required minLength={3} maxLength={100} placeholder="e.g. Dr. Asha Rao" />
              </label>
              <label className="field">
                <span className="field__label">Their email</span>
                <input name="email" type="email" required maxLength={254} placeholder="name@hkbk.edu.in" />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Role</span>
                <select name="role" defaultValue={roles[0]}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Department (optional)</span>
                <select name="branch" defaultValue="">
                  <option value="">None</option>
                  {BRANCHES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <button className="button button--primary" type="submit">
                Send invitation
              </button>
            </div>
          </ActionForm>
          {pending.length > 0 && <h3>Invited, not joined yet</h3>}
          {pending.length > 0 && (
            <ul className="wf-list">
              {pending.map((i) => (
                <li key={i.email} className="wf-member">
                  <div className="wf-member__who">
                    <span className="wf-member__name">{i.name}</span>
                    <span className="wf-muted">
                      {i.email} · {ROLE_LABEL[i.role]}
                      {i.branchName ? ` · ${i.branchName}` : ""} · {i.used ? "joined" : i.expiresAt < Date.now() ? "link ran out" : `invited ${timeAgo(i.createdAt)}`}
                    </span>
                  </div>
                  {!i.used && (
                    <ActionForm action={revokeInviteAction} showDone={false}>
                      <input type="hidden" name="email" value={i.email} />
                      <button className="button button--secondary wf-small" type="submit">
                        Cancel invitation
                      </button>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <h2>The team</h2>
      <ul className="wf-list">
        {list.map((u) => (
          <li key={u.id} className="wf-member">
            <div className="wf-member__who">
              <Link className="wf-member__name" href={`/desk/members/${u.id}`}>
                {u.name}
              </Link>
              <span className="wf-muted">{u.email}</span>
            </div>
            <div className="wf-actions">
              <span className="wf-tag">{ROLE_LABEL[u.role]}</span>
              {u.locked && <span className="wf-tag" title="Set by the site's technical team. You can't change it from the college desk.">Fixed</span>}
              {u.suspended && <span className="wf-tag wf-tag--red">Paused</span>}
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="wf-empty">Nobody yet.</p>}
    </>
  );
}

export async function SiteSettings({ me }: { me: User }) {
  const s = await deskSettings(me);
  if (!s) return null;
  const canEdit = isSuperAdmin(me);
  return (
    <ActionForm action={settingsAction} className="wf-stack">
      {!canEdit && <p className="wf-card">Only a super administrator can change these settings. You can only view them.</p>}
      <fieldset className="wf-card" disabled={!canEdit}>
        <legend>
          <strong>Joining</strong>
        </legend>
        <label className="wf-check">
          <input type="checkbox" name="joiningOpen" defaultChecked={s.joiningOpen} /> New members can join
        </label>
      </fieldset>
      <fieldset className="wf-card" disabled={!canEdit}>
        <legend>
          <strong>Features</strong> (when one is off, people can still read it but can't add new things)
        </legend>
        {(Object.keys(FEATURE_LABEL) as (keyof typeof FEATURE_LABEL)[]).map((k) => (
          <label key={k} className="wf-check">
            <input type="checkbox" name={k} defaultChecked={s.features[k]} /> {FEATURE_LABEL[k]}
          </label>
        ))}
      </fieldset>
      <fieldset className="wf-card" disabled={!canEdit}>
        <legend>
          <strong>Limits</strong>
        </legend>
        <label className="field">
          <span className="field__label">Connection requests each member can send per day</span>
          <input name="dailyRequests" type="number" min={1} max={200} defaultValue={s.dailyRequests} required />
        </label>
      </fieldset>
      {canEdit && (
        <div>
          <button className="button button--primary" type="submit">
            Save settings
          </button>
        </div>
      )}
    </ActionForm>
  );
}

export async function Audit({ me, q }: { me: User; q: string }) {
  const log = await auditLog(me, { q });
  return (
    <>
      <div className="wf-actions" style={{ justifyContent: "space-between" }}>
        <form action="/desk" className="wf-actions" role="search">
          <input type="hidden" name="tab" value="audit" />
          <label className="field" style={{ margin: 0 }}>
            <span className="field__label">Search for</span>
            <input name="q" defaultValue={q} maxLength={100} placeholder="a name, “paused”, “role”…" />
          </label>
          <button className="button button--primary wf-small" type="submit">
            Search
          </button>
        </form>
        <a className="button button--secondary wf-small" href="/desk/audit.csv" download>
          Download all (CSV)
        </a>
      </div>
      {log.length === 0 ? (
        <p className="wf-empty">Nothing yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="wf-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id}>
                  <td>{when(e.createdAt)}</td>
                  <td>{e.actor}</td>
                  <td>{capital(e.action)}</td>
                  <td>
                    {capital(e.subject)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
