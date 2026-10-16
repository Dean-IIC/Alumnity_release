"use client";

import { useEffect, useState } from "react";

/** Bringing your batch in: share the join link on WhatsApp, or copy it. */
export function Invite({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  // The site's own address, once in the browser (the server can't know which one it's served as).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const message = `${text} ${origin}/join`;
  return (
    <div className="wf-actions">
      <a className="button button--primary wf-small" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        Invite on WhatsApp
      </a>
      <button
        type="button"
        className="button button--secondary wf-small"
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
        {copied ? "Copied ✓" : "Copy invite link"}
      </button>
    </div>
  );
}
