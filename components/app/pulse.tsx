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
type Thread = { with: number; latest: number; seen?: number; changed?: number };

/** Asks every pulse on the page to check at once (see PulseNow). */
const CHECK_NOW = "alumnity:pulse";

/**
 * Around every page (the counts, every 25 s), and in an open conversation (its newest
 * message, how far they've read, and the last edit or deletion, every 4 s). Each redraws
 * only when what it watches has changed.
 */
export function Pulse({ counts, thread }: { counts?: Counts; thread?: Thread }) {
  const router = useRouter();
  const known = useRef({ ...(counts ?? { n: 0, m: 0, r: 0 }), t: thread?.latest ?? 0, s: thread?.seen ?? 0, e: thread?.changed ?? 0 });

  useEffect(() => {
    known.current = { ...(counts ?? known.current), t: thread?.latest ?? 0, s: thread?.seen ?? 0, e: thread?.changed ?? 0 };
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
  }, [counts?.n, counts?.m, counts?.r, thread?.latest, thread?.seen, thread?.changed]);

  useEffect(() => {
    const every = thread ? 4_000 : 25_000;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    // One question at a time: asked again while one is out, it asks once more when that's
    // back (two at once used to leave two timers running, and the asking doubled).
    let busy = false;
    let again = false;
    const ask = async () => {
      if (stopped) return;
      if (busy) {
        again = true;
        return;
      }
      clearTimeout(timer);
      busy = true;
      if (document.visibilityState === "visible" && navigator.onLine) {
        try {
          const now = await (await fetch(`/api/pulse${thread ? `?thread=${thread.with}` : ""}`, { cache: "no-store" })).json();
          const was = known.current;
          const changed = thread ? now.t !== was.t || now.s !== was.s || now.e !== was.e : now.n !== was.n || now.m !== was.m || now.r !== was.r;
          if (changed) {
            known.current = now;
            router.refresh();
          }
        } catch {
          // Offline for a moment: try again next time.
        }
      }
      busy = false;
      if (stopped) return;
      if (again) {
        again = false;
        void ask();
      } else timer = setTimeout(ask, every);
    };
    timer = setTimeout(ask, every);
    // Coming back to the tab, or a page saying it just read something: check at once.
    const now = () => void ask();
    const back = () => document.visibilityState === "visible" && now();
    document.addEventListener("visibilitychange", back);
    window.addEventListener(CHECK_NOW, now);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener(CHECK_NOW, now);
    };
  }, [router, thread?.with]);

  return null;
}

/**
 * Put on a page that reads things as it's drawn (a conversation, the notifications): once
 * it's on screen (so the reading is done), and again whenever `on` changes, the bar's
 * counts are checked at once. The bar sits in the layout, which Next doesn't redraw when
 * moving between pages, so its badges used to keep the old numbers for up to 25 seconds;
 * and when a page and the layout were drawn together, the layout could count before the
 * page had read anything.
 */
export function PulseNow({ on }: { on?: string | number }) {
  useEffect(() => {
    window.dispatchEvent(new Event(CHECK_NOW));
  }, [on]);
  return null;
}
