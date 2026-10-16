"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/*
 * Keeps a signed-in page up to date without reloading it: every so often (often in an
 * open conversation, less elsewhere, never while the tab is hidden) it asks /api/pulse
 * what's new, and only when something has changed does the page redraw itself from the
 * server (keeping whatever you were typing). The tab's title shows how much is unread.
 */

type Counts = { n: number; m: number; r: number };

/**
 * Around every page (the counts, every 25 s), and in an open conversation (its newest
 * message, every 4 s). Each redraws only when what it watches has changed.
 */
export function Pulse({ counts, thread }: { counts?: Counts; thread?: { with: number; latest: number } }) {
  const router = useRouter();
  const known = useRef({ ...(counts ?? { n: 0, m: 0, r: 0 }), t: thread?.latest ?? 0 });

  useEffect(() => {
    known.current = { ...(counts ?? known.current), t: thread?.latest ?? 0 };
    if (!counts) return;
    const unread = counts.n + counts.m;
    const apply = () => {
      const base = document.title.replace(/^\(\d+\+?\) /, "");
      const want = unread ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    // Next sets the page's own title as it renders: put the count back each time.
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => watch.disconnect();
  }, [counts?.n, counts?.m, counts?.r, thread?.latest]);

  useEffect(() => {
    const every = thread ? 4_000 : 25_000;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const ask = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible" && navigator.onLine) {
        try {
          const now = await (await fetch(`/api/pulse${thread ? `?thread=${thread.with}` : ""}`, { cache: "no-store" })).json();
          const was = known.current;
          const changed = thread ? now.t !== was.t : now.n !== was.n || now.m !== was.m || now.r !== was.r;
          if (changed) {
            known.current = now;
            router.refresh();
          }
        } catch {
          // Offline for a moment: try again next time.
        }
      }
      timer = setTimeout(ask, every);
    };
    timer = setTimeout(ask, every);
    // Coming back to the tab: check at once.
    const back = () => document.visibilityState === "visible" && (clearTimeout(timer), ask());
    document.addEventListener("visibilitychange", back);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [router, thread?.with]);

  return null;
}
