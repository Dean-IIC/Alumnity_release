"use client";

import { useRef, useState, useTransition } from "react";
import { aiAskHelpAction } from "../../lib/actions/ai";

type Suggestion = { title: string; details: string; topics: string };

/**
 * "Help me ask": reads what the student has written in the question form around it, and
 * suggests a clearer question with the details a senior needs (gaps in [brackets] for them
 * to fill). Nothing changes until they choose "Use this"; they still send it themselves.
 */
export function AskHelper() {
  const here = useRef<HTMLDivElement>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const field = (name: string) => here.current?.closest("form")?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  const read = (name: string) => field(name)?.value ?? "";
  // Set as typing would, so the form (and the browser's own checks) see the new words.
  const write = (name: string, value: string) => {
    const el = field(name);
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <div className="ai-help" ref={here}>
      <button
        type="button"
        className="button button--secondary wf-small"
        disabled={busy}
        onClick={() => {
          setError(null);
          start(async () => {
            const answer = await aiAskHelpAction({ title: read("title"), details: read("body"), topics: read("topics") });
            if (!answer.ok) return setError(answer.error);
            setSuggestion({ title: answer.title, details: answer.details, topics: answer.topics });
          });
        }}
      >
        {busy ? "Thinking…" : "✦ Help me ask"}
      </button>
      {error && (
        <p className="ai-note ai-note--error" role="alert">
          {error}
        </p>
      )}
      {suggestion && (
        <section className="ai-suggestion" aria-label="Suggested question">
          <p className="ai-suggestion__label">A clearer way to ask (fill in anything in [brackets])</p>
          <strong>{suggestion.title}</strong>
          <p>{suggestion.details}</p>
          {suggestion.topics && <p className="ai-suggestion__topics">Topics: {suggestion.topics}</p>}
          <div className="ai-suggestion__actions">
            <button
              type="button"
              className="button button--primary wf-small"
              onClick={() => {
                write("title", suggestion.title);
                write("body", suggestion.details);
                if (suggestion.topics) write("topics", suggestion.topics);
                setSuggestion(null);
                field("body")?.focus();
              }}
            >
              Use this
            </button>
            <button type="button" className="button button--secondary wf-small" onClick={() => setSuggestion(null)}>
              Keep mine
            </button>
          </div>
          <p className="ai-note">Written by AI from your words. Check it before you send.</p>
        </section>
      )}
    </div>
  );
}
