import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { ReportButton } from "../../../components/app/report-button";
import { Give } from "../../../components/causes/give";
import { closeCauseAction, payoutAction, reviewCauseAction } from "../../../lib/actions/causes";
import { timeAgo, when } from "../../../lib/format";
import { mediaUrl } from "../../../lib/media-url";
import { causeFor, payouts, rupees, supporters } from "../../../lib/server/causes";
import { donationsOpen } from "../../../lib/server/razorpay";
import { isAdmin, isModerator } from "../../../lib/server/roles";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "A cause · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One cause: its story, how much it has raised and been paid, who gave, and giving. */
export default async function CausePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/causes/${raw}`);
  const id = Number(raw);
  const cause = Number.isSafeInteger(id) && id > 0 ? await causeFor(me, id) : null;
  if (!cause) notFound();
  const [people, paid] = await Promise.all([supporters(me, cause.id), payouts(me, cause.id)]);
  const percent = Math.min(100, Math.round((cause.raised / cause.goal) * 100));
  const ended = cause.endsAt !== null && cause.endsAt < Date.now();
  const hidden = <input type="hidden" name="id" value={cause.id} />;

  return (
    <AppPage
      user={me}
      current="causes"
      back={{ href: "/causes", label: "Causes" }}
      title={cause.title}
      intro={cause.author ? <>Started by <a href={`/people/${cause.author.id}`}>{cause.author.name}</a> · {timeAgo(cause.createdAt)}</> : undefined}
    >
      {cause.status === "pending" && <p className="wf-card">Waiting for the college desk to read it. Only you and the desk can see it until then.</p>}
      {cause.status === "rejected" && <p className="wf-card">The college desk didn't approve this cause{cause.reviewNote ? `: ${cause.reviewNote}` : "."}</p>}
      {cause.status === "closed" && <p className="wf-card">This cause is closed{cause.reviewNote ? `: ${cause.reviewNote}` : "."} What was given stays on record below.</p>}

      {cause.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cause-cover" src={mediaUrl(cause.cover, 640)} alt="" />
      )}

      <section className="wf-card" aria-label="Raised so far">
        <p>
          <strong>{rupees(cause.raised)}</strong> raised of {rupees(cause.goal)} · {cause.supporters} {cause.supporters === 1 ? "supporter" : "supporters"}
          {cause.endsAt && cause.status === "live" ? ` · ${ended ? "ended" : `until ${when(cause.endsAt)}`}` : ""}
        </p>
        <span className="cause-bar" role="img" aria-label={`${percent}% of the goal`}>
          <span style={{ width: `${percent}%` }} />
        </span>
        {cause.paidOut > 0 && <p className="wf-muted">{rupees(cause.paidOut)} paid out by the college so far.</p>}
      </section>

      <div className="wf-prose">
        {cause.story.split(/\n{2,}/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {cause.status === "live" && !ended && (donationsOpen() ? <Give causeId={cause.id} name={me.name} email={me.email} /> : <p className="wf-empty">Giving opens once the college has set up payments.</p>)}

      <div className="wf-actions">
        {!cause.mine && cause.status === "live" && <ReportButton kind="cause" id={cause.id} />}
        {(cause.mine || isModerator(me)) && (cause.status === "live" || cause.status === "pending") && (
          <ActionForm action={closeCauseAction} confirm="Close this cause? No more donations; what was given stays on record.">
            {hidden}
            <button className="button button--secondary wf-small" type="submit">
              Close the cause
            </button>
          </ActionForm>
        )}
      </div>

      {isModerator(me) && cause.status === "pending" && (
        <section className="wf-card" aria-labelledby="review">
          <h2 id="review">College desk: review</h2>
          <ActionForm action={reviewCauseAction} confirm="Approve it? It goes live for every member, and can take donations.">
            {hidden}
            <input type="hidden" name="answer" value="approve" />
            <button className="button button--primary" type="submit">
              Approve: it goes live
            </button>
          </ActionForm>
          <ActionForm action={reviewCauseAction} className="wf-stack">
            {hidden}
            <input type="hidden" name="answer" value="reject" />
            <label className="field">
              <span className="field__label">Or turn it down, saying why (its author sees this)</span>
              <textarea name="note" rows={2} maxLength={500} required />
            </label>
            <div>
              <button className="button button--secondary" type="submit">
                Turn it down
              </button>
            </div>
          </ActionForm>
        </section>
      )}

      {people.length > 0 && (
        <>
          <h2>Who gave</h2>
          <ul className="wf-list">
            {people.map((p, i) => (
              <li key={i} className="wf-member">
                <div className="wf-member__who">
                  <span className="wf-member__name">{p.memberId ? <a href={`/people/${p.memberId}`}>{p.name}</a> : "Someone"}</span>
                  <span className="wf-muted">
                    {timeAgo(p.at)}
                    {p.amount !== null ? ` · ${rupees(p.amount)}` : ""}
                  </span>
                  {p.message && <span className="wf-member__detail">“{p.message}”</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {(paid.length > 0 || isAdmin(me)) && cause.status !== "pending" && cause.status !== "rejected" && (
        <>
          <h2>Paid out by the college</h2>
          {paid.length === 0 ? (
            <p className="wf-empty">Nothing paid out yet.</p>
          ) : (
            <ul className="wf-list">
              {paid.map((p, i) => (
                <li key={i} className="wf-member">
                  <div className="wf-member__who">
                    <span className="wf-member__name">{rupees(p.amount)}</span>
                    <span className="wf-muted">
                      {when(p.at)} · {p.note}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {isAdmin(me) && (
            <ActionForm action={payoutAction} className="wf-stack" resetOnSuccess>
              {hidden}
              <div className="field-row">
                <label className="field">
                  <span className="field__label">Amount paid out (₹)</span>
                  <input name="amount" required inputMode="decimal" maxLength={12} />
                </label>
                <label className="field">
                  <span className="field__label">What for, and to whom</span>
                  <input name="note" required maxLength={300} placeholder="e.g. Semester fees, paid to the college accounts office" />
                </label>
              </div>
              <div>
                <button className="button button--secondary" type="submit">
                  Record payout
                </button>
              </div>
            </ActionForm>
          )}
        </>
      )}
    </AppPage>
  );
}
