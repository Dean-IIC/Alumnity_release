import type { Metadata } from "next";
import { ActionForm } from "../../components/app/action-form";
import { AppPage } from "../../components/app/app-page";
import { askAction } from "../../lib/actions/content";
import { timeAgo } from "../../lib/format";
import { asksFor, isSenior, type Ask } from "../../lib/server/asks";
import { profileOf } from "../../lib/server/profile";
import { PAUSED, settings } from "../../lib/server/settings";
import { requireUser } from "../../lib/server/session";

export const metadata: Metadata = { title: "Ask a senior · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<Ask["status"], string> = { open: "Waiting for a senior", taken: "A senior is on it", answered: "Answered", closed: "Closed" };

function AskList({ asks, empty }: { asks: Ask[]; empty: string }) {
  if (!asks.length) return <p className="wf-empty">{empty}</p>;
  return (
    <ul className="wf-list">
      {asks.map((a) => (
        <li key={a.id} className="wf-member">
          <div className="wf-member__who">
            <a className="wf-member__name" href={`/ask/${a.id}`}>
              {a.title}
            </a>
            <span className="wf-muted">
              {a.author.name} · {timeAgo(a.createdAt)}
              {a.reason ? ` · came to you: ${a.reason}` : ""}
            </span>
          </div>
          <span className={`wf-tag ${a.status === "open" ? "wf-tag--red" : ""}`}>{STATUS[a.status]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ask a question; see yours; seniors see what's come to them. */
export default async function AskPage() {
  const me = await requireUser("/ask");
  const { mine, forMe, taken, open } = await asksFor(me);
  const senior = isSenior(me);
  const mentoring = (await profileOf(me.id)).happyTo.mentor;

  return (
    <AppPage
      user={me}
      current="ask"
      title="Ask a senior"
      intro="Your question goes to a few seniors who fit it (by branch and what they know), not to everyone. One takes it on and writes to you privately."
    >
      <section aria-labelledby="new-ask">
        <h2 id="new-ask">Ask something</h2>
        {!(await settings()).features.asks && <p className="wf-empty">{PAUSED}</p>}
        {(await settings()).features.asks && <ActionForm action={askAction} className="wf-stack">
          <label className="field">
            <span className="field__label">Your question, in a line</span>
            <input name="title" required maxLength={140} placeholder="e.g. How did you prepare for campus placements?" />
          </label>
          <label className="field">
            <span className="field__label">A few lines more</span>
            <textarea name="body" rows={4} required maxLength={2000} placeholder="What you've tried, what you're stuck on, what would help." />
          </label>
          <label className="field">
            <span className="field__label">Topics (optional, separated by commas)</span>
            <input name="topics" maxLength={200} placeholder="e.g. Placements, Java, Higher studies" />
            <span className="field__hint">Topics help it reach seniors who know them.</span>
          </label>
          <div>
            <button className="button button--primary" type="submit">
              Send the question <span aria-hidden="true">→</span>
            </button>
          </div>
        </ActionForm>}
      </section>

      {senior && (
        <>
          <h2>Sent to you</h2>
          {!mentoring && (
            <p className="wf-card">
              Questions only reach you once you say you're happy to mentor. <a href="/me/edit">Turn it on in your page</a>.
            </p>
          )}
          <AskList asks={forMe} empty="Nothing waiting for you right now." />
          {taken.length > 0 && (
            <>
              <h2>You're helping with</h2>
              <AskList asks={taken} empty="" />
            </>
          )}
          {open.length > 0 && (
            <>
              <h2>Open to any senior</h2>
              <p className="wf-muted">These didn't fit anyone in particular. If you can help, take one on.</p>
              <AskList asks={open} empty="" />
            </>
          )}
        </>
      )}

      <h2>Your questions</h2>
      <AskList asks={mine} empty="You haven't asked anything yet." />
    </AppPage>
  );
}
