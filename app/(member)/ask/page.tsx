import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { mentorAction } from "../../../lib/actions/social";
import { askAction } from "../../../lib/actions/content";
import { timeAgo } from "../../../lib/format";
import { asksFor, isSenior, type Ask } from "../../../lib/server/asks";
import { profileOf } from "../../../lib/server/profile";
import { PAUSED, settings } from "../../../lib/server/settings";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Ask a senior · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<Ask["status"], string> = { open: "Waiting for a senior", taken: "A senior is helping", answered: "Answered", closed: "Closed" };

function AskList({ asks, empty }: { asks: Ask[]; empty: string }) {
  if (!asks.length) return <p className="wf-empty">{empty}</p>;
  return (
    <ul className="wf-list">
      {asks.map((a) => (
        <li key={a.id} className="wf-member">
          <div className="wf-member__who">
            <Link className="wf-member__name" href={`/ask/${a.id}`}>
              {a.title}
            </Link>
            <span className="wf-muted">
              {a.author.name} · {timeAgo(a.createdAt)}
              {a.reason ? ` · sent to you because: ${a.reason}` : ""}
            </span>
          </div>
          <span className={`wf-tag ${a.status === "open" ? "wf-tag--red" : ""}`}>{STATUS[a.status]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ask a question; see yours; seniors see what's come to them. */
export default async function AskPage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  // Started from Home ("Ask a senior: …"): the question is already typed.
  const started = ((await searchParams).title ?? "").slice(0, 140);
  const me = await requireUser("/ask");
  const { mine, forMe, taken, open } = await asksFor(me);
  const senior = isSenior(me);
  const mentoring = (await profileOf(me.id)).happyTo.mentor;

  const site = await settings();

  const form = site.features.asks ? (
    <ActionForm action={askAction} className="wf-stack">
      <label className="field">
        <span className="field__label">Your question, in one line</span>
        <input name="title" required maxLength={140} placeholder="e.g. How did you prepare for campus placements?" defaultValue={started} autoFocus={Boolean(started)} />
      </label>
      <label className="field">
        <span className="field__label">More details (a senior needs these to help you)</span>
        <textarea name="body" rows={4} required maxLength={2000} placeholder="What have you tried? Where are you stuck? What would help?" />
      </label>
      <label className="field">
        <span className="field__label">Topics (optional, with commas between them)</span>
        <input name="topics" maxLength={200} placeholder="e.g. Placements, Java, Higher studies" />
        <span className="field__hint">Topics help the right seniors find your question.</span>
      </label>
      {/* Held in sight on a phone: below the first screen, a blind test never saw it, and
          tapped the tab bar's Post instead (which leaves the page, question and all). */}
      <div className="ask-send">
        <button className="button button--primary" type="submit">
          Send question <span aria-hidden="true">→</span>
        </button>
      </div>
    </ActionForm>
  ) : (
    <p className="wf-empty">{PAUSED}</p>
  );

  const helping = senior && (
    <>
      <h2>Sent to you</h2>
      {mentoring ? (
        <div className="wf-card ask-switch ask-switch--on">
          <p>
            <strong>You are a mentor.</strong> Questions that match your branch and skills come here. Busy? Pause it, and turn it back on any time.
          </p>
          <ActionForm action={mentorAction}>
            <input type="hidden" name="mentor" value="off" />
            <button className="button wf-small" type="submit">
              Pause mentoring
            </button>
          </ActionForm>
        </div>
      ) : (
        <div className="wf-card ask-switch">
          <p>
            <strong>Questions come to you only if you agree to mentor.</strong> Then questions that match you come here, a few at a time.
            You can turn it off any time.
          </p>
          <ActionForm action={mentorAction}>
            <button className="button button--primary wf-small" type="submit">
              Start mentoring
            </button>
          </ActionForm>
        </div>
      )}
      <AskList asks={forMe} empty={mentoring ? "No questions for you right now. When one fits you, we'll show it here and tell you." : "Nothing yet."} />
      {taken.length > 0 && (
        <>
          <h2>You're helping with</h2>
          <AskList asks={taken} empty="" />
        </>
      )}
      {open.length > 0 && (
        <>
          <h2>Open to any senior</h2>
          <p className="wf-muted">These questions didn't match any one senior. Can you help? Take one.</p>
          <AskList asks={open} empty="" />
        </>
      )}
    </>
  );

  return (
    <AppPage
      user={me}
      current="ask"
      title="Ask a senior"
      intro={
        senior
          ? "Each question goes to a few seniors who match its branch or topic. Take one, and you reply just to that student."
          : "Only a few seniors who match your branch or topic get your question. One of them takes it and replies just to you."
      }
    >
      {/* Seniors mostly answer: their questions first, asking folded away. Students ask first. */}
      {senior ? (
        <>
          {helping}
          <details className="wf-fold" open={Boolean(started)}>
            <summary>Ask your own question</summary>
            {form}
          </details>
        </>
      ) : (
        <section aria-labelledby="new-ask">
          <h2 id="new-ask">Ask a question</h2>
          {form}
        </section>
      )}

      <h2>Your questions</h2>
      <AskList asks={mine} empty={senior ? "You haven't asked anything." : "You haven't asked anything yet. Start small: how to pick electives, or what an internship is like."} />
    </AppPage>
  );
}
