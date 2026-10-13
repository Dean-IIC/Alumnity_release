"use client";

import { useCallback, useState } from "react";
import { GrowingCampusIntro } from "./growing-campus-intro";
import { BrandLockup } from "./brand-lockup";
import { HERO_IMAGE, WELCOME_COPY } from "../lib/campus";

export function CampusLanding() {
  const [introComplete, setIntroComplete] = useState(false);
  const completeIntro = useCallback(() => setIntroComplete(true), []);

  return (
    <main className={`landing ${introComplete ? "landing--intro-complete" : ""}`}>
      <GrowingCampusIntro onComplete={completeIntro} />

      {/* The intro reveals this from the centre outwards. */}
      <div className="landing-ui" data-reveal-root>
        <header className="landing-nav">
          <a className="landing-nav__brand" href="#welcome" aria-label="Alumnity by HKBK College of Engineering, home">
            <BrandLockup data-brand-target />
          </a>
          <nav aria-label="Primary navigation"><a href="#how-it-works">How it works</a><a href="#explore">Explore people</a></nav>
          <a className="sign-in" href="#sign-in">Sign in <span aria-hidden="true">↗</span></a>
        </header>

        <section className="hero" id="welcome" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="hero-kicker">HKBK College of Engineering · Alumni</p>
            <h1 id="welcome-title">{WELCOME_COPY.title}</h1>
            <p className="hero-text">A network for HKBK people to ask, guide and grow — together.</p>
            <div className="hero-actions">
              <a className="button button--primary" href="#find-your-place">{WELCOME_COPY.primaryAction} <span aria-hidden="true">→</span></a>
              <a className="button button--secondary" id="sign-in" href="#already-here">{WELCOME_COPY.secondaryAction} <span aria-hidden="true">→</span></a>
            </div>
            <p className="hero-note"><span aria-hidden="true">◌</span> A place to ask. A place to give back.</p>
          </div>
          <div className="photo-reveal" aria-label="HKBK College of Engineering campus">
            <div className="photo-frame" style={{ backgroundImage: `url(${HERO_IMAGE})` }} />
            <div className="photo-caption"><span>HKBK College of Engineering</span><strong>Where it all began</strong></div>
          </div>
        </section>
      </div>
    </main>
  );
}
