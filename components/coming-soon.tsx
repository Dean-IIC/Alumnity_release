"use client";

import { useEffect, useState, type MouseEvent } from "react";

/**
 * Pages not built yet. Their links point where the pages will live, but say so instead of
 * leading nowhere; delete an entry once its page exists.
 */
const COMING_SOON: Record<string, string> = {
  "/join": "Joining",
  "/login": "Logging in",
  "/how-it-works": "How it works",
  "/people": "Exploring people"
};

const EVENT = "alumnity:soon";

/** Click handler for any link: if its page isn't built yet, say so instead of following it. */
export function soon(event: MouseEvent<HTMLAnchorElement>) {
  const what = COMING_SOON[event.currentTarget.getAttribute("href") ?? ""];
  if (!what) return;
  event.preventDefault();
  window.dispatchEvent(new CustomEvent(EVENT, { detail: `${what} opens soon — this is an early preview of Alumnity.` }));
}

/** The notice those links raise. One per page. */
export function SoonNotice() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let timer = 0;
    const show = (event: Event) => {
      setNotice((event as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setNotice(null), 3600);
    };
    window.addEventListener(EVENT, show);
    return () => {
      window.removeEventListener(EVENT, show);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <p className={`soon-notice ${notice ? "soon-notice--shown" : ""}`} role="status" aria-live="polite">
      {notice}
    </p>
  );
}
