"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aiPeopleSearchAction } from "../../lib/actions/ai";
import { Icon } from "../social/icons";

/**
 * "Describe who you're looking for": a sentence becomes Network's own filters (words,
 * branch, batch, happy to mentor / refer / talk), and the page shows that search. The AI
 * only reads the sentence; the search itself is the ordinary one, with every privacy rule.
 */
export function AiPeopleSearch() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      className="ai-search"
      onSubmit={(e) => {
        e.preventDefault();
        setNote(null);
        start(async () => {
          const answer = await aiPeopleSearchAction(text);
          if (!answer.ok) return setNote({ ok: false, text: answer.error });
          setNote({ ok: true, text: `Searching for: ${answer.summary}` });
          router.push(answer.href);
        });
      }}
    >
      <label className="ai-search__label" htmlFor="ai-search">
        <Icon name="search" size={18} /> Or describe who you're looking for
      </label>
      <div className="ai-search__row">
        <input
          id="ai-search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="e.g. alumni in Bengaluru working in data who can mentor"
          aria-describedby="ai-search-note"
        />
        <button type="submit" className="button button--primary" disabled={busy || text.trim().length < 3}>
          {busy ? "Finding…" : "Find with AI"}
        </button>
      </div>
      <p id="ai-search-note" className={`ai-note ${note && !note.ok ? "ai-note--error" : ""}`} role="status">
        {note ? note.text : "The AI turns your words into the filters above. It only reads what you type here."}
      </p>
    </form>
  );
}
