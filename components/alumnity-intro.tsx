"use client";

import { useEffect, useState } from "react";
import { shouldPlayIntro, writeIntroPreference } from "../lib/intro-preference";
import { LOGO } from "./brand-lockup";

/*
 * Alumnity's opening, in the college's colours: on navy, the HKBK crest; rings go out
 * from it, one for every batch (the year rings of the Batch pages); the years count up
 * from 1997, when the college began; "Alumnity." rises in with its gold dot and the
 * college's name; then the whole of it lifts away to the page. About three and a half
 * seconds.
 *
 * It's CSS from the first paint (rendered on the server), so it plays even before the
 * page's scripts arrive, and never flashes the page first. The <head> script
 * (INTRO_PREFERENCE_SCRIPT) hides it at once for anyone who chose not to see it again or
 * prefers less motion; "Skip intro" works from the first moment too (it carries the
 * class that script listens for). ?intro=1 always plays it.
 */

const LETTERS = "Alumnity".split("");
const RINGS = 9;

export function AlumnityIntro({ year }: { year: number }) {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [skipNext, setSkipNext] = useState(false);

  useEffect(() => {
    if (!shouldPlayIntro()) setGone(true);
  }, []);

  if (gone) return null;

  const skip = () => {
    document.documentElement.dataset.intro = "skip";
    setLeaving(true);
    window.setTimeout(() => setGone(true), 450);
  };

  return (
    <div className={`alm-intro ${leaving ? "alm-intro--leaving" : ""}`} onAnimationEnd={(e) => e.target === e.currentTarget && setGone(true)}>
      {/* The year the counter ends on: this year. */}
      <style>{`@keyframes alm-years { from { --alm-year: 1997; } to { --alm-year: ${year}; } }`}</style>
      <div className="alm-intro__stage" aria-hidden="true">
        <div className="alm-intro__rings">
          {Array.from({ length: RINGS }, (_, i) => (
            <span key={i} style={{ animationDelay: `${0.35 + i * 0.14}s` }} className={i % 3 === 2 ? "alm-intro__ring alm-intro__ring--gold" : "alm-intro__ring"} />
          ))}
        </div>
        <div className="alm-intro__crest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="" width={256} height={256} />
        </div>
        <p className="alm-intro__years">
          <span className="alm-intro__count" />
          <small>every batch since 1997</small>
        </p>
        <p className="alm-intro__word">
          {LETTERS.map((l, i) => (
            <span key={i} style={{ animationDelay: `${1.55 + i * 0.06}s` }}>
              {l}
            </span>
          ))}
          <span className="alm-intro__dot" style={{ animationDelay: `${1.55 + LETTERS.length * 0.06 + 0.1}s` }}>
            .
          </span>
        </p>
        <p className="alm-intro__college">HKBK College of Engineering · Alumni Network</p>
      </div>
      <div className="alm-intro__controls">
        <label>
          <input
            type="checkbox"
            checked={skipNext}
            onChange={(event) => {
              setSkipNext(event.target.checked);
              writeIntroPreference(event.target.checked ? "skip" : "play");
            }}
          />
          Don’t play the intro next time
        </label>
        <button type="button" className="ink-intro__skip alm-intro__skip" onClick={skip}>
          Skip intro <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
