"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { GrowingCampusIntro } from "./growing-campus-intro";
import { BrandLockup } from "./brand-lockup";
import { WELCOME_COPY } from "../lib/campus";
import { HeroInk } from "./hero-ink";
import { SiteFooter } from "./site-footer";

/**
 * Pages not built yet. Their links point where the pages will live, but say so instead of
 * leading nowhere; delete an entry once its page exists.
 */
const COMING_SOON: Record<string, string> = {
  "/join": "Joining",
  "/sign-in": "Signing in",
  "/how-it-works": "How it works",
  "/people": "Exploring people",
  "/gallery": "The gallery"
};

export function CampusLanding() {
  const [introComplete, setIntroComplete] = useState(false);
  const completeIntro = useCallback(() => setIntroComplete(true), []);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const soon = (event: MouseEvent<HTMLAnchorElement>) => {
    const what = COMING_SOON[event.currentTarget.getAttribute("href") ?? ""];
    if (!what) return;
    event.preventDefault();
    setNotice(`${what} opens soon — this is an early preview of Alumnity.`);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3600);
  };

  return (
    <main className={`landing ${introComplete ? "landing--intro-complete" : ""}`}>
      <GrowingCampusIntro onComplete={completeIntro} />

      {/* The intro reveals this from the centre outwards. */}
      <div className="landing-ui" data-reveal-root>
        <header className="landing-nav container">
          <a className="landing-nav__brand" href="#welcome" aria-label="Alumnity by HKBK College of Engineering, home">
            <BrandLockup data-brand-target />
          </a>
          <nav aria-label="Primary navigation">
            <a href="/how-it-works" onClick={soon}>How it works</a>
            <a href="/people" onClick={soon}>Explore people</a>
          </nav>
          <a className="sign-in" href="/sign-in" onClick={soon}>Sign in <span aria-hidden="true">↗</span></a>
        </header>

        <section className="hero container" id="welcome" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="hero-kicker">HKBK College of Engineering · Alumni</p>
            <h1 id="welcome-title">{WELCOME_COPY.title}</h1>
            <p className="hero-text">A network for HKBK people to ask, guide and grow — together.</p>
            <div className="hero-actions">
              <a className="button button--primary" href="/join" onClick={soon}>{WELCOME_COPY.primaryAction} <span aria-hidden="true">→</span></a>
              <a className="button button--secondary" href="/sign-in" onClick={soon}>{WELCOME_COPY.secondaryAction} <span aria-hidden="true">→</span></a>
            </div>
            <p className="hero-note"><span aria-hidden="true">◌</span> A place to ask. A place to give back.</p>
          </div>
          <HeroInk active={introComplete} onExplore={soon} />
        </section>

        <SiteFooter />
      </div>

      <p className={`soon-notice ${notice ? "soon-notice--shown" : ""}`} role="status" aria-live="polite">
        {notice}
      </p>
    </main>
  );
}
