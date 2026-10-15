import { ActionForm } from "../app/action-form";
import { announceAction, removeAnnouncementAction, resolveReportAction, restoreAction, settingsAction, takeDownAction } from "../../lib/actions/desk";
import { BRANCHES } from "../../lib/branches";
import { batchLabel, ROLE_LABEL, timeAgo, when } from "../../lib/format";
import type { User } from "../../lib/server/auth";
import { allAnnouncements } from "../../lib/server/announcements";
import { auditLog, deskMembers, deskSettings, recentContent, reports, stats, team, type ContentKind, type MemberFilter } from "../../lib/server/desk";
import { isAdmin, isSuperAdmin } from "../../lib/server/roles";
import { FEATURE_LABEL } from "../../lib/server/settings";

/* The college desk's sections. Each checks the viewer's role again on the server (lib/server/desk.ts). */

export async function Overview({ me }: { me: User }) {
  const s = await stats(me);
  if (!s) return null;
  const peak = Math.max(1, ...s.joinsByWeek);
  const items: [string, number, string?][] = [
    ["Members", s.members],
    ["Joined this week", s.joinedThisWeek],
    ["Signed in this week", s.signedInThisWeek],
    ["Alumni", s.alumni],
    ["Students", s.students],
    ["Happy to mentor", s.mentors],
    ["Connections", s.connections],
    ["Asks", s.asks],
    ["Asks answered", s.answered],
    ["Notes", s.posts],
    ["Events", s.events],
    ["Open reports", s.openReports, "/desk?tab=reports"],
    ["Paused", s.paused, "/desk?tab=members&status=paused"]
  ];
  return (
    <>
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
      <p className="wf-muted">Totals only; sample members aren't counted.</p>
    </>
  );
}

export async function Reports({ me, closed }: { me: User; closed: boolean }) {
  const list = await reports(me, closed ? "closed" : "open");
  return (
    <>
      <p>
        <a className="wf-link-button" href={closed ? "/desk?tab=reports" : "/desk?tab=reports&closed=1"}>
          {closed ? "← Open reports" : "Dealt with →"}
        </a>
      </p>
      {list.length === 0 && <p className="wf-empty">{closed ? "Nothing dealt with yet." : "No open reports. All quiet."}</p>}
      {list.map((r) => (
        <article key={r.id} className="wf-card">
          <div className="wf-card__meta">
            <span className="wf-tag">{r.kind}</span>
            <span>Reported {timeAgo(r.createdAt)}</span>
            {r.status !== "open" && <span className="wf-tag">{r.status}</span>}
          </div>
          <p>
            <strong>Why:</strong> {r.reason}
          </p>
          {r.subject ? (
            <p>
              <strong>{r.kind === "member" ? "Member" : "What was written"}:</strong>{" "}
              {r.kind === "member" && r.subject.owner ? <a href={`/desk/members/${r.subject.owner.id}`}>{r.subject.text}</a> : r.subject.text}
              {r.subject.owner && r.kind !== "member" && (
                <>
                  <br />
                  <span className="wf-muted">
                    By <a href={`/desk/members/${r.subject.owner.id}`}>{r.subject.owner.name}</a>
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="wf-muted">It's already gone.</p>
          )}
          {r.status === "open" && (
            <div className="wf-actions">
              <ActionForm action={resolveReportAction} confirm={r.kind === "member" ? "Pause this member? They're signed out and hidden until unpaused." : "Take this down?"}>
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
  ["post", "Notes"],
  ["comment", "Comments"],
  ["ask", "Asks"]
];

export async function Content({ me, kind, q }: { me: User; kind: ContentKind; q: string }) {
  const list = await recentContent(me, kind, q);
  const admin = isAdmin(me);
  return (
    <>
      <div className="wf-tabs">
        {CONTENT_TABS.map(([k, label]) => (
          <a key={k} href={`/desk?tab=content&kind=${k}`} aria-current={k === kind ? "page" : undefined}>
            {label}
          </a>
        ))}
      </div>
      <form action="/desk" className="wf-actions" role="search">
        <input type="hidden" name="tab" value="content" />
        <input type="hidden" name="kind" value={kind} />
        <label className="field" style={{ flex: 1, margin: 0 }}>
          <span className="field__label">Containing</span>
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
            {c.author && <a href={`/desk/members/${c.author.id}`}>{c.author.name}</a>}
            <span>{timeAgo(c.createdAt)}</span>
            {c.removed && <span className="wf-tag wf-tag--red">{c.kind === "ask" ? "Closed" : "Taken down"}</span>}
          </div>
          <p>{c.text}</p>
          <div className="wf-actions">
            {!c.removed ? (
              <ActionForm action={takeDownAction} confirm="Take this down? Its author is told it broke the community rules.">
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
                    Bring back
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
              <a className="wf-member__name" href={`/desk/members/${u.id}`}>
                {u.name}
              </a>
              <span className="wf-muted">
                {u.email} · {batchLabel(u) || "—"} · {ROLE_LABEL[u.role]} · joined {timeAgo(u.createdAt)}
              </span>
            </div>
            <div className="wf-actions">
              {u.suspended && <span className="wf-tag wf-tag--red">Paused</span>}
              {u.sample && <span className="wf-tag">Sample</span>}
              <a className="button button--secondary wf-small" href={`/desk/members/${u.id}`}>
                Manage
              </a>
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="wf-empty">Nobody matches.</p>}
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
          <span className="field__label">What it says</span>
          <textarea name="body" rows={3} required maxLength={1000} />
        </label>
        <label className="field">
          <span className="field__label">Show it for</span>
          <select name="days" defaultValue="14">
            <option value="3">3 days</option>
            <option value="7">A week</option>
            <option value="14">Two weeks</option>
            <option value="30">A month</option>
            <option value="0">Until it's taken down</option>
          </select>
        </label>
        <div>
          <button className="button button--primary" type="submit">
            Announce
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
  const list = await team(me);
  return (
    <>
      <p className="wf-muted">
        Super administrators are named in the server's config (ALUMNITY_SUPER_ADMINS) and can't be removed from the site. They make administrators; administrators make
        coordinators. To appoint someone, open them in Members.
      </p>
      <ul className="wf-list">
        {list.map((u) => (
          <li key={u.id} className="wf-member">
            <div className="wf-member__who">
              <a className="wf-member__name" href={`/desk/members/${u.id}`}>
                {u.name}
              </a>
              <span className="wf-muted">{u.email}</span>
            </div>
            <div className="wf-actions">
              <span className="wf-tag">{ROLE_LABEL[u.role]}</span>
              {u.locked && <span className="wf-tag" title="Set in the server's config">Config</span>}
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
      {!canEdit && <p className="wf-card">Only a super administrator can change these. You can see them.</p>}
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
          <strong>Features</strong> (paused ones stay readable; nothing new can be added)
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
          <span className="field__label">Connection requests one member may send in a day</span>
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
            <span className="field__label">Containing</span>
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
                <th>Did</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id}>
                  <td>{when(e.createdAt)}</td>
                  <td>{e.actor}</td>
                  <td>{e.action}</td>
                  <td>
                    {e.subject}
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
