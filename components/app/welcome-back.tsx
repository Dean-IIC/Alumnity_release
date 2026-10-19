"use client";

import { useEffect, useState } from "react";
import { COLLEGE_NAME, LOGO } from "../brand-lockup";

/** Set by the log-in form (components/join/login-form.tsx) just before it leaves for the signed-in page. */
export const WELCOME_BACK_KEY = "alumnity:welcome-back";

/** How long the greeting stays, and how long it takes to fade (join-scan.css). */
const SHOWN_FOR = 1500;
const FADE = 360;

/*
 * "Welcome back, Asha." with the college crest, for a moment, on the first signed-in page
 * after logging in, and never otherwise: the log-in form leaves a one-time flag in this
 * tab's sessionStorage, and this reads it and clears it at once (a reload, or another page,
 * shows nothing). It never blocks the page: taps go straight through to it, and any tap or
 * key also sends the greeting away. The name comes from the server's own record of who's
 * signed in, never from the browser.
 */
export function WelcomeBack({ name }: { name: string }) {
  const [phase, setPhase] = useState<"hidden" | "shown" | "leaving">("hidden");

  useEffect(() => {
    let wanted = false;
    try {
      wanted = sessionStorage.getItem(WELCOME_BACK_KEY) === "1";
    } catch {
      // Storage turned off: no greeting.
    }
    if (!wanted || !name) return;

    const timers: number[] = [];
    const leave = () => {
      setPhase((p) => (p === "shown" ? "leaving" : p));
      timers.push(window.setTimeout(() => setPhase("hidden"), FADE));
    };
    const skip = () => leave();
    timers.push(
      window.setTimeout(() => {
        // Cleared only once it's really shown (React's development double-run of this effect
        // would otherwise use up the flag on the run it throws away).
        try {
          sessionStorage.removeItem(WELCOME_BACK_KEY);
        } catch {
          // Nothing to clear.
        }
        setPhase("shown");
      }, 0)
    );
    timers.push(window.setTimeout(leave, SHOWN_FOR));
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [name]);

  if (phase === "hidden") return null;
  return (
    <div className={`welcome-back${phase === "leaving" ? " welcome-back--leaving" : ""}`} role="status" aria-live="polite">
      <div className="welcome-back__card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="welcome-back__crest" src={LOGO} alt="" width={256} height={256} />
        <p className="welcome-back__line">
          Welcome back, <span className="welcome-back__name">{name}</span>.
        </p>
        <p className="welcome-back__sub">{COLLEGE_NAME} · Alumnity</p>
      </div>
    </div>
  );
}
