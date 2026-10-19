import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../../components/app/action-form";
import { AppPage } from "../../../../components/app/app-page";
import { ReportButton } from "../../../../components/app/report-button";
import { answeredAction, closeAskAction, replyAskAction, takeAskAction } from "../../../../lib/actions/content";
import { firstName, timeAgo } from "../../../../lib/format";
import { askFor, askThread, isSenior } from "../../../../lib/server/asks";
import { requireUser } from "../../../../lib/server/session";

export const metadata: Metadata = { title: "A question · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One Ask: the question, who's on it, the private thread, and what each side can do. */
export default async function AskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/ask/${raw}`);
  const id = Number(raw);
  const ask = Number.isSafeInteger(id) && id > 0 ? await askFor(me, id) : null;
  if (!ask) notFound();
  const asker = ask.author.id === me.id;
  const taker = ask.taker?.id === me.id;
  const messages = await askThread(me, ask.id);
  const hidden = <input type="hidden" name="id" value={ask.id} />;

  return (
    <AppPage user={me} current="ask" back={{ href: "/ask", label: "Ask a senior" }} title={ask.title} intro={`Asked by ${asker ? "you" : ask.author.name} · ${timeAgo(ask.createdAt)}`}>
      <article className="wf-card">
        <p>{ask.body}</p>
        <div className="wf-actions">
          {ask.topics.map((t) => (
            <span key={t} className="wf-tag">
              {t}
            </span>
          ))}
        </div>
      </article>

      {ask.reason && !taker && <p className="wf-muted">Why we sent it to you: {ask.reason}.</p>}

      {ask.status === "open" && (
        <section className="wf-card">
          {asker ? (
            <p>We sent your question to a few seniors who match it. We will tell you when one of them takes it.</p>
          ) : isSenior(me) ? (
            <ActionForm action={takeAskAction}>
              {hidden}
              <p>Can you help? If you take this question, you will reply to {firstName(ask.author.name)} privately, on this page.</p>
              <button className="button button--primary" type="submit">
                Take this question
              </button>
            </ActionForm>
          ) : null}
        </section>
      )}

      {ask.taker && (asker || taker) && (
        <section aria-labelledby="thread">
          <h2 id="thread">{asker ? `${ask.taker.name} is helping you` : `You're helping ${ask.author.name}`}</h2>
          <div className="wf-thread">
            {messages.length === 0 && <p className="wf-empty">{taker ? "Start with a hello and your first thoughts." : "They will reply to you here."}</p>}
            {messages.map((m) => (
              <div key={m.id} className={`wf-bubble ${m.mine ? "wf-bubble--mine" : ""}`}>
                {m.body}
                <small>
                  {firstName(m.author.name)} · {timeAgo(m.createdAt)}
                </small>
              </div>
            ))}
          </div>
          {(ask.status === "taken" || ask.status === "answered") && (
            <ActionForm action={replyAskAction} resetOnSuccess className="wf-stack" showDone={false}>
              {hidden}
              <label className="sr-only" htmlFor="reply">
                Your reply
              </label>
              <textarea id="reply" name="body" rows={3} required maxLength={2000} placeholder="Write a reply…" />
              <div>
                <button className="button button--primary wf-small" type="submit">
                  Send
                </button>
              </div>
            </ActionForm>
          )}
        </section>
      )}

      {asker && ask.status === "taken" && (
        <section aria-labelledby="done">
          <h2 id="done">Did it help?</h2>
          <ActionForm action={answeredAction} className="wf-stack">
            {hidden}
            <label className="field">
              <span className="field__label">A short thank-you note (optional; it is shown on {firstName(ask.taker?.name ?? "")}'s Record)</span>
              <textarea name="thanks" rows={2} maxLength={300} />
            </label>
            <div>
              <button className="button button--primary wf-small" type="submit">
                Mark as answered
              </button>
            </div>
          </ActionForm>
        </section>
      )}

      {ask.status === "answered" && (
        <p className="wf-card">
          Answered{ask.thanks ? `, with thanks: “${ask.thanks}”` : "."}
        </p>
      )}

      <div className="wf-actions" style={{ marginTop: "var(--space-6)" }}>
        {asker && (ask.status === "open" || ask.status === "taken") && (
          <ActionForm action={closeAskAction} confirm="Close this question? No one can reply after you close it.">
            {hidden}
            <button className="wf-link-button" type="submit">
              Close question
            </button>
          </ActionForm>
        )}
        {!asker && <ReportButton kind="ask" id={ask.id} back={`/ask/${ask.id}`} />}
        <Link className="wf-link-button" href="/ask">
          ← All questions
        </Link>
      </div>
    </AppPage>
  );
}
