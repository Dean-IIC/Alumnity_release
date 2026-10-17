"use client";

import { useCallback, useState } from "react";
import { GrowingCampusIntro } from "./growing-campus-intro";
import { WELCOME_COPY } from "../lib/campus";
import { HeroInk } from "./hero-ink";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { soon, SoonNotice } from "./coming-soon";

export function CampusLanding() {
  const [introComplete, setIntroComplete] = useState(false);
  const completeIntro = useCallback(() => setIntroComplete(true), []);

  return (
    <main className={`landing force-light ${introComplete ? "landing--intro-complete" : ""}`}>
      <GrowingCampusIntro onComplete={completeIntro} />

      {/* The intro reveals this from the centre outwards. */}
      <div className="landing-ui" data-reveal-root>
        <SiteHeader landing />

        <section className="hero container" id="welcome" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="hero-kicker">HKBK College of Engineering · Alumni</p>
            <h1 id="welcome-title">{WELCOME_COPY.title}</h1>
            <p className="hero-text">A network for HKBK people to ask, guide and grow — together.</p>
            <div className="hero-actions">
              <a className="button button--primary" href="/join" onClick={soon}>{WELCOME_COPY.primaryAction} <span aria-hidden="true">→</span></a>
              <a className="button button--secondary" href="/login" onClick={soon}>{WELCOME_COPY.secondaryAction} <span aria-hidden="true">→</span></a>
            </div>
            <p className="hero-note"><span aria-hidden="true">◌</span> A place to ask. A place to give back.</p>
          </div>
          <HeroInk active={introComplete} />
        </section>

        <SiteFooter />
      </div>

      <SoonNotice />
    </main>
  );
}
