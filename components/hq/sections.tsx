import Link from "next/link";
import { ActionForm } from "../app/action-form";
import { ConfirmDelete } from "../desk/confirm-delete";
import { deleteRegisterAction, importRegisterAction, mailAction, mailBatchAction, saveMemberRecordAction, saveRegisterAction } from "../../lib/actions/hq";
import { BRANCHES } from "../../lib/branches";
import { ROLE_LABEL, when } from "../../lib/format";
import type { User } from "../../lib/server/auth";
import { AUDIENCE_LABEL, hqMember, hqMembers, hqRegister, hqRegisterLine, mailouts, MAIL_BATCH, REGISTER_BRANCHES, tableSizes, type RegisterEntry, type RegisterQuery } from "../../lib/server/hq";
import { smtpReady } from "../../lib/server/mail";

/* HQ's sections (/hq): plain forms and tables. Each asks lib/server/hq.ts, which checks the role again. */

const n = (x: number) => x.toLocaleString("en-IN");

function BranchSelect({ value, any = false }: { value?: string | null; any?: boolean }) {
  return (
    <select name="branch" defaultValue={value ?? ""}>
      {any && <option value="">Any</option>}
      {REGISTER_BRANCHES.map(([code, name]) => (
        <option key={code} value={code}>
          {code} · {name}
        </option>
      ))}
    </select>
  );
}

function LineFields({ line }: { line?: RegisterEntry }) {
  return (
    <div className="hq-fields">
      <label className="field">
        <span className="field__label">Name</span>
        <input name="name" defaultValue={line?.name} required maxLength={120} />
      </label>
      <label className="field">
        <span className="field__label">USN</span>
        <input name="usn" defaultValue={line?.usn} required maxLength={20} />
      </label>
      <label className="field">
        <span className="field__label">Branch</span>
        <BranchSelect value={line?.branch ?? "CSE"} />
      </label>
      <label className="field">
        <span className="field__label">Course</span>
        <input name="programme" defaultValue={line?.programme ?? "B.Tech"} maxLength={40} />
      </label>
      <label className="field">
        <span className="field__label">Year joined</span>
        <input name="year" type="number" defaultValue={line?.year} required min={1990} max={new Date().getFullYear() + 1} />
      </label>
    </div>
  );
}

export async function Register({ me, query, edit }: { me: User; query: RegisterQuery; edit?: number }) {
  const [found, line] = await Promise.all([hqRegister(me, query), edit ? hqRegisterLine(me, edit) : null]);
  if (!found) return null;
  const href = (more: Record<string, string>) =>
    `/hq?${new URLSearchParams({ tab: "register", q: query.q ?? "", branch: query.branch ?? "", year: query.year ? String(query.year) : "", page: String(found.page), ...more })}`;
  return (
    <>
      <form action="/hq" className="wf-filters" role="search">
        <input type="hidden" name="tab" value="register" />
        <label className="field">
          <span className="field__label">Name or USN</span>
          <input name="q" defaultValue={query.q} maxLength={100} />
        </label>
        <label className="field">
          <span className="field__label">Branch</span>
          <BranchSelect value={query.branch} any />
        </label>
        <label className="field">
          <span className="field__label">Year joined</span>
          <input name="year" type="number" defaultValue={query.year} min={1990} max={new Date().getFullYear() + 1} />
        </label>
        <span />
        <button className="button button--primary wf-small" type="submit">
          Search
        </button>
      </form>

      {line && (
        <section className="wf-card hq-panel" id="edit">
          <h2>
            Edit {line.name} <span className="hq-mono wf-muted">{line.usn}</span>
          </h2>
          {line.member && (
            <p className="wf-muted">
              They’ve joined Alumnity: changing this line doesn’t change their account (edit that under <Link href={`/hq?tab=members&edit=${line.member}`}>Members</Link>).
            </p>
          )}
          <ActionForm action={saveRegisterAction}>
            <input type="hidden" name="id" value={line.id} />
            <LineFields line={line} />
            <div className="wf-actions">
              <button className="button button--primary wf-small" type="submit">
                Save
              </button>
              <Link className="button button--secondary wf-small" href={href({})}>
                Close
              </Link>
            </div>
          </ActionForm>
          <ConfirmDelete action={deleteRegisterAction} id={line.id} label="Delete from the register" title={`Delete ${line.name} from the register?`} confirm="Delete">
            {line.usn}, {line.branch} {line.year}. Nobody can join Alumnity with this line any more. Anyone who already joined keeps their account.
          </ConfirmDelete>
        </section>
      )}

      <details className="hq-add">
        <summary>Add someone to the register</summary>
        <ActionForm action={saveRegisterAction} resetOnSuccess>
          <LineFields />
          <button className="button button--primary wf-small" type="submit">
            Add
          </button>
        </ActionForm>
      </details>

      <p className="wf-muted">
        {n(found.total)} on the register{query.q || query.branch || query.year ? " match" : ""}. Page {found.page} of {found.pages}.
      </p>
      <div className="hq-scroll">
        <table className="wf-table hq-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>USN</th>
              <th>Branch</th>
              <th>Course</th>
              <th>Joined</th>
              <th>On Alumnity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {found.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="hq-mono">{r.usn}</td>
                <td>{r.branch}</td>
                <td>{r.programme}</td>
                <td>{r.year}</td>
                <td>{r.member ? <Link href={`/desk/members/${r.member}`}>Yes</Link> : ""}</td>
                <td>
                  <Link href={`${href({ edit: String(r.id) })}#edit`} aria-current={r.id === line?.id ? "true" : undefined}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {found.pages > 1 && (
        <nav className="hq-pages" aria-label="Pages">
          {found.page > 1 && <Link href={href({ page: String(found.page - 1) })}>← Previous</Link>}
          {found.page < found.pages && <Link href={href({ page: String(found.page + 1) })}>Next →</Link>}
        </nav>
      )}
    </>
  );
}

export function ImportExport() {
  return (
    <>
      <section className="wf-card">
        <h2>Download</h2>
        <p>
          <a className="button button--secondary wf-small" href="/hq/register.csv" download>
            The register (CSV)
          </a>{" "}
          <a className="button button--secondary wf-small" href="/hq/members.csv" download>
            Every member, with emails (CSV)
          </a>{" "}
          <a className="button button--secondary wf-small" href="/desk/audit.csv" download>
            The audit log (CSV)
          </a>
        </p>
        <p className="wf-muted">These hold students’ personal details. Keep the files safe and delete them when you’re done. Each download goes in the audit log.</p>
      </section>
      <section className="wf-card">
        <h2>Import into the register</h2>
        <p>
          A CSV file whose first line names the columns: <code>name, usn, branch, programme, year</code> (<code>branch_name</code> optional). Branch is one of{" "}
          {REGISTER_BRANCHES.map(([c]) => c).join(", ")}; year is the year they joined. The register’s own download is in this form.
        </p>
        <p className="wf-muted">Matched by USN: new USNs are added, known ones are updated. An import never deletes anyone. Press “Check” first to see what would change.</p>
        <ActionForm action={importRegisterAction}>
          <label className="field">
            <span className="field__label">CSV file</span>
            <input type="file" name="file" accept=".csv,text/csv" required />
          </label>
          <div className="wf-actions">
            <button className="button button--secondary wf-small" type="submit" name="mode" value="check">
              Check
            </button>
            <button className="button button--primary wf-small" type="submit" name="mode" value="apply">
              Import
            </button>
          </div>
        </ActionForm>
      </section>
    </>
  );
}

export async function Members({ me, q, edit }: { me: User; q: string; edit?: number }) {
  const [list, m] = await Promise.all([hqMembers(me, q), edit ? hqMember(me, edit) : null]);
  if (!list) return null;
  const href = (more: Record<string, string>) => `/hq?${new URLSearchParams({ tab: "members", q, ...more })}`;
  return (
    <>
      <form action="/hq" className="wf-filters hq-filters--one" role="search">
        <input type="hidden" name="tab" value="members" />
        <label className="field">
          <span className="field__label">Name, email or USN</span>
          <input name="q" defaultValue={q} maxLength={100} />
        </label>
        <button className="button button--primary wf-small" type="submit">
          Search
        </button>
      </form>

      {m && (
        <section className="wf-card hq-panel" id="edit">
          <h2>
            Edit {m.name} <span className="wf-muted">{m.email}</span>
          </h2>
          <p className="wf-muted">Their email is their login, so it isn’t changed here. Role, pausing, logging out and deleting: “Manage”.</p>
          <ActionForm action={saveMemberRecordAction}>
            <input type="hidden" name="id" value={m.id} />
            <div className="hq-fields">
              <label className="field">
                <span className="field__label">Name</span>
                <input name="name" defaultValue={m.name} required maxLength={120} />
              </label>
              <label className="field">
                <span className="field__label">USN</span>
                <input name="usn" defaultValue={m.usn ?? ""} maxLength={20} />
              </label>
              <label className="field">
                <span className="field__label">Branch</span>
                <select name="branch" defaultValue={m.branch ?? ""}>
                  <option value="">None</option>
                  {REGISTER_BRANCHES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {code} · {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Course</span>
                <input name="programme" defaultValue={m.programme ?? ""} maxLength={40} />
              </label>
              <label className="field">
                <span className="field__label">Year joined HKBK</span>
                <input name="joined" type="number" defaultValue={m.joined ?? ""} min={1990} max={new Date().getFullYear() + 1} />
              </label>
            </div>
            <div className="wf-actions">
              <button className="button button--primary wf-small" type="submit">
                Save
              </button>
              <Link className="button button--secondary wf-small" href={`/desk/members/${m.id}`}>
                Manage
              </Link>
              <Link className="button button--secondary wf-small" href={href({})}>
                Close
              </Link>
            </div>
          </ActionForm>
        </section>
      )}

      <p className="wf-muted">{list.length === 100 ? "The newest 100 that match." : `${n(list.length)} found.`}</p>
      <div className="hq-scroll">
        <table className="wf-table hq-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>USN</th>
              <th>Batch</th>
              <th>Role</th>
              <th>Joined Alumnity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>
                  {x.name}
                  {x.paused && <span className="wf-tag wf-tag--red">Paused</span>}
                  {x.sample && <span className="wf-tag">Sample</span>}
                </td>
                <td>{x.email}</td>
                <td className="hq-mono">{x.usn}</td>
                <td>{[x.branch, x.joined].filter(Boolean).join(" ")}</td>
                <td>{ROLE_LABEL[x.role] ?? x.role}</td>
                <td>{when(x.createdAt)}</td>
                <td>
                  <Link href={`${href({ edit: String(x.id) })}#edit`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export async function Mail({ me }: { me: User }) {
  const sent = await mailouts(me);
  if (!sent) return null;
  const ready = smtpReady();
  return (
    <>
      {!ready && (
        <p className="wf-note wf-note--error">
          Email isn’t set up on this server yet, so nothing can be sent. It needs SMTP_HOST, SMTP_USER and SMTP_PASS (the noreply Gmail’s app password, or Loops).
        </p>
      )}
      <section className="wf-card">
        <h2>Write to members</h2>
        <p className="wf-muted">
          Each member gets it with their own name (“Dear Asha,”), a button to open Alumnity, and a link to stop emails. It goes out {MAIL_BATCH} at a time: send yourself a test
          first.
        </p>
        <ActionForm action={mailAction}>
          <div className="hq-fields">
            <label className="field">
              <span className="field__label">To</span>
              <select name="who" defaultValue="everyone">
                {Object.entries(AUDIENCE_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Branch</span>
              <select name="branch" defaultValue="">
                <option value="">Any</option>
                {BRANCHES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Year joined</span>
              <input name="year" type="number" min={1990} max={new Date().getFullYear() + 1} placeholder="Any" />
            </label>
          </div>
          <label className="hq-check">
            <input type="checkbox" name="everyone" value="1" /> Also those who turned emails off (only for something they must know)
          </label>
          <label className="field">
            <span className="field__label">Subject</span>
            <input name="subject" required maxLength={150} />
          </label>
          <label className="field">
            <span className="field__label">Email (a blank line between paragraphs)</span>
            <textarea name="body" rows={10} required maxLength={10000} />
          </label>
          <div className="wf-actions">
            <button className="button button--secondary wf-small" type="submit" name="mode" value="test">
              Send me a test
            </button>
            <button className="button button--primary wf-small" type="submit" name="mode" value="send">
              Send to them
            </button>
          </div>
        </ActionForm>
      </section>
      <section className="wf-card">
        <h2>Sent</h2>
        {sent.length ? (
          <ul className="wf-list">
            {sent.map((m) => {
              const left = Math.max(0, m.total - m.sent);
              return (
                <li key={m.id} className="wf-member">
                  <div className="wf-member__who">
                    <strong>{m.subject}</strong>
                    <span className="wf-muted">
                      {m.audience} · {when(m.createdAt)}
                      {m.by && ` · by ${m.by}`}
                    </span>
                    <span>
                      {n(m.sent)} of {n(m.total)} sent{m.failed ? `, ${n(m.failed)} failed` : ""}
                    </span>
                  </div>
                  {left > 0 && (
                    <ActionForm action={mailBatchAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="button button--secondary wf-small" type="submit">
                        Send the next batch
                      </button>
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="wf-muted">Nothing sent yet.</p>
        )}
      </section>
    </>
  );
}

export async function Database({ me }: { me: User }) {
  const sizes = await tableSizes(me);
  if (!sizes) return null;
  return (
    <section className="wf-card">
      <h2>Tables</h2>
      <table className="wf-table hq-table">
        <thead>
          <tr>
            <th>Table</th>
            <th>Rows</th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((t) => (
            <tr key={t.table}>
              <td className="hq-mono">{t.table}</td>
              <td>{n(t.rows)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="wf-muted">
        Supabase’s free plan keeps no backups: download the register and the members (Import &amp; export) before a big change. Anything bigger than these pages (a
        restore, a new column) is done in Supabase, not here.
      </p>
    </section>
  );
}
