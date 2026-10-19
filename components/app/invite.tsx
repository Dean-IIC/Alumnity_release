"use client";

import { useEffect, useState } from "react";

/**
 * Bringing your batch in: share the join link on WhatsApp, or copy it.
 * `compact`: the small pair of pills on a person's card in People (one per person not on
 * Alumnity yet), rather than the full-size buttons under a section.
 */
export function Invite({ text, compact = false }: { text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  // The site's own address, once in the browser (the server can't know which one it's served as).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const message = `${text} ${origin}/join`;
  return (
    <div className={compact ? "invite-pills" : "wf-actions"}>
      <a
        className={compact ? "people-btn people-btn--invite" : "button button--primary wf-small"}
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {compact ? "Invite" : "Invite on WhatsApp"}
      </a>
      <button
        type="button"
        className={compact ? "people-btn people-btn--quiet" : "button button--secondary wf-small"}
        aria-label={compact ? "Copy the invite link" : undefined}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            window.prompt("Copy this invite:", message);
          }
        }}
      >
        {copied ? "Copied ✓" : compact ? "Copy link" : "Copy invite link"}
      </button>
    </div>
  );
}
