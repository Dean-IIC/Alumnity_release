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
export function AiPeopleSearch({ typed = "" }: { typed?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  // Empty here, it uses what's in Network's main search: a blind test typed its sentence
  // there and pressed "Find with AI" nine times, the button greyed out.
  const words = text.trim() || typed.trim();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      className="ai-search"
      onSubmit={(e) => {
        e.preventDefault();
        setNote(null);
        start(async () => {
          const answer = await aiPeopleSearchAction(words);
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
          placeholder={typed.trim() ? `Or press Find with AI to search "${typed.trim().slice(0, 40)}"` : "e.g. alumni in Bengaluru working in data who can mentor"}
          aria-describedby="ai-search-note"
        />
        <button type="submit" className="button button--primary" disabled={busy || words.length < 3}>
          {busy ? "Finding…" : "Find with AI"}
        </button>
      </div>
      <p id="ai-search-note" className={`ai-note ${note && !note.ok ? "ai-note--error" : ""}`} role="status">
        {note ? note.text : "The AI turns your words into the filters above. It only reads what you type here."}
      </p>
    </form>
  );
}
