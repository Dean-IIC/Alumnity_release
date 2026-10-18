import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../../components/app/action-form";
import { AppPage } from "../../../../components/app/app-page";
import { MemberLine } from "../../../../components/app/member-line";
import { ReportButton } from "../../../../components/app/report-button";
import { acceptReferralAction, closeOpeningAction, requestReferralAction } from "../../../../lib/actions/openings";
import { BRANCHES } from "../../../../lib/branches";
import { firstName, timeAgo } from "../../../../lib/format";
import { OPENING_LIMITS, openingById, referralRequests } from "../../../../lib/server/openings";
import { isModerator } from "../../../../lib/server/roles";
import { requireUser } from "../../../../lib/server/session";

export const metadata: Metadata = { title: "An opening · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND = { job: "Job", internship: "Internship" } as const;
const day = (at: number) => new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/** One opening: what it is, where to apply, and asking for a referral (or, for its poster, who asked). */
export default async function OpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/openings/${raw}`);
  const id = Number(raw);
  const o = Number.isSafeInteger(id) && id > 0 ? await openingById(me, id) : null;
  if (!o) notFound();
  const manage = o.mine || isModerator(me);
  const asked = manage ? await referralRequests(me, o.id) : [];
  const poster = o.poster ? firstName(o.poster.name) : "them";
  const hidden = <input type="hidden" name="id" value={o.id} />;

  return (
    <AppPage
      user={me}
      current="openings"
      back={{ href: "/openings", label: "Jobs & referrals" }}
      title={o.title}
      intro={`${o.company}${o.place ? ` · ${o.place}` : ""}`}
    >
      <article className="wf-card">
        {o.closed && <p className="wf-note">This opening has closed.</p>}
        <p>
          <strong>Kind:</strong> {KIND[o.kind]}
          <br />
          <strong>Suits:</strong> {o.branch ? (BRANCHES.find(([c]) => c === o.branch)?.[1] ?? o.branch) : "Any branch"}
          <br />
          <strong>Open till:</strong> {day(o.closesAt)}
          {o.poster && (
            <>
              <br />
              <strong>Put up by:</strong>{" "}
              <Link className="wf-inline-link" href={`/people/${o.poster.id}`}>
                {o.poster.name}
              </Link>{" "}
              · {timeAgo(o.createdAt)}
            </>
          )}
        </p>
        {o.body && <p className="wf-prose">{o.body}</p>}
        {o.link && (
          <p>
            <a className="button button--secondary" href={o.link} rel="noopener noreferrer nofollow" target="_blank">
              Apply on the company's site <span aria-hidden="true">↗</span>
            </a>
          </p>
        )}
      </article>

      {!o.mine && (
        <section aria-labelledby="referral">
          <h2 id="referral">A referral</h2>
          {o.myRequest ? (
            o.myRequest.accepted ? (
              <p className="wf-note">
                {poster} said yes. You're connected now:{" "}
                <Link className="wf-inline-link" href={`/messages/${o.poster?.id}`}>
                  message {poster}
                </Link>{" "}
                to send your CV and talk it through.
              </p>
            ) : (
              <p className="wf-note">You asked {timeAgo(o.myRequest.at)}. {poster} will get back to you here; you'll get a notification.</p>
            )
          ) : !o.canRefer ? (
            <p className="wf-muted">{poster} isn't taking referral requests for this one. Use the link to apply.</p>
          ) : o.closed ? (
            <p className="wf-muted">It's closed, so it can't take requests now.</p>
          ) : (
            <ActionForm action={requestReferralAction} className="wf-stack" resetOnSuccess>
              {hidden}
              <label className="field">
                <span className="field__label">Ask {poster} to refer you</span>
                <textarea
                  name="note"
                  rows={4}
                  required
                  minLength={20}
                  maxLength={OPENING_LIMITS.note}
                  placeholder="Your branch and year, what you've built or studied that fits, and why this role. Keep it short."
                />
                <span className="field__hint">Only {poster} sees this. If they say yes, you're connected and can message each other.</span>
              </label>
              <div>
                <button className="button button--primary" type="submit">
                  Ask for a referral
                </button>
              </div>
            </ActionForm>
          )}
        </section>
      )}

      {manage && (
        <section aria-labelledby="asked">
          <h2 id="asked">Who asked · {asked.length}</h2>
          {asked.length === 0 ? (
            <p className="wf-empty">Nobody yet. Students see it in Jobs & referrals, and those in its branch see it on Home.</p>
          ) : (
            <ul className="wf-list">
              {asked.map((r) => (
                <MemberLine key={r.requester.id} member={r.requester} detail={`Asked ${timeAgo(r.at)}`} note={r.note}>
                  {o.mine &&
                    (r.accepted ? (
                      <Link className="button button--secondary wf-small" href={`/messages/${r.requester.id}`}>
                        Message
                      </Link>
                    ) : (
                      <ActionForm action={acceptReferralAction} showDone={false}>
                        {hidden}
                        <input type="hidden" name="user" value={r.requester.id} />
                        <button className="button button--primary wf-small" type="submit">
                          I'll refer them
                        </button>
                      </ActionForm>
                    ))}
                </MemberLine>
              ))}
            </ul>
          )}
          {!o.closed && (
            <ActionForm action={closeOpeningAction} confirm="Take this opening down? People can't ask for a referral after that.">
              {hidden}
              <button className="wf-link-button" type="submit" style={{ marginTop: "var(--space-4)" }}>
                Take it down
              </button>
            </ActionForm>
          )}
        </section>
      )}

      <p style={{ marginTop: "var(--space-6)" }}>
        <Link className="wf-link-button" href="/openings">
          ← All openings
        </Link>
        {!o.mine && (
          <>
            {" · "}
            <ReportButton kind="opening" id={o.id} back={`/openings/${o.id}`} />
          </>
        )}
      </p>
    </AppPage>
  );
}
