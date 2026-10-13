"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAMPUS_STOPS, DEFAULT_STOP_ID, findCampusStop, type CampusStopId } from "../lib/campus";

const REVEAL_DELAY_MS = 680;
const IDLE_SELECTION_DELAY_MS = 5000;

export function CampusLanding() {
  const [selectedId, setSelectedId] = useState<CampusStopId>(DEFAULT_STOP_ID);
  const [resolved, setResolved] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
  }, []);

  const revealStop = useCallback((id: CampusStopId) => {
    clearTimers();
    setSelectedId(id);
    setResolved(false);
    revealTimer.current = window.setTimeout(() => setResolved(true), REVEAL_DELAY_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setResolved(true);
      return;
    }
    idleTimer.current = window.setTimeout(() => revealStop(DEFAULT_STOP_ID), IDLE_SELECTION_DELAY_MS);
    return clearTimers;
  }, [clearTimers, revealStop]);

  const selected = findCampusStop(selectedId) ?? CAMPUS_STOPS[0];

  return (
    <main className={`landing ${resolved ? "landing--resolved" : ""}`}>
      <div className="sky-wash" aria-hidden="true" />
      <header className="landing-nav">
        <a className="wordmark" href="#welcome" aria-label="Alumnity home">alumnity<span>.</span></a>
        <nav aria-label="Primary navigation"><a href="#how-it-works">How it works</a><a href="#explore">Explore people</a></nav>
        <a className="sign-in" href="#sign-in">Sign in <span aria-hidden="true">↗</span></a>
      </header>

      <section className="campus-scene" aria-labelledby="scene-title">
        <p className="scene-kicker">HKBK, drawn from memory</p>
        <h1 id="scene-title">Find the place you still carry with you.</h1>
        <p className="scene-instruction">Explore the campus. It will lead you back in.</p>
        <div className="campus-atlas" aria-hidden="true">
          <span className="campus-atlas-slice campus-atlas-slice--arrival" />
          <span className="campus-atlas-slice campus-atlas-slice--west" />
          <span className="campus-atlas-slice campus-atlas-slice--heart" />
          <span className="campus-atlas-slice campus-atlas-slice--east" />
        </div>
        <svg className="route-line" viewBox="0 0 1000 520" aria-hidden="true"><path d="M278 436C347 395 404 407 465 363s70-99 150-88 132 49 199-31" /><circle cx="278" cy="436" r="7" /><circle cx="465" cy="363" r="7" /><circle cx="814" cy="244" r="8" /></svg>
        <div className="building-markers" id="explore" aria-label="Choose a campus building">
          {CAMPUS_STOPS.map((stop, index) => <button className={`building-marker ${selectedId === stop.id ? "is-selected" : ""}`} key={stop.id} style={{ "--x": `${stop.x}%`, "--y": `${stop.y}%`, "--delay": `${index * 90}ms` } as React.CSSProperties} type="button" aria-pressed={selectedId === stop.id} onClick={() => revealStop(stop.id)}><span className="marker-dot" aria-hidden="true" /><span className="marker-copy"><strong>{stop.label}</strong><small>{stop.eyebrow}</small></span></button>)}
        </div>
        {!resolved && <button className="skip-intro" type="button" onClick={() => revealStop(selectedId)}>Skip intro <span aria-hidden="true">→</span></button>}
      </section>

      <section className="hero" id="welcome" aria-labelledby="welcome-title">
        <div className="hero-copy"><p className="hero-kicker">HKBK alumni network</p><h2 id="welcome-title">Stay connected<br />to where it began.</h2><p className="hero-text">A network for HKBK people to ask, guide and grow — together.</p><div className="hero-actions"><a className="button button--primary" href="#find-your-place">Find your place <span aria-hidden="true">→</span></a><a className="button button--secondary" id="sign-in" href="#already-here">I’m already here <span aria-hidden="true">→</span></a></div><p className="hero-note"><span aria-hidden="true">◌</span> A place to ask. A place to give back.</p></div>
        <div className="photo-reveal" aria-label={`${selected.label}, HKBK campus`}><div className="photo-frame" style={{ backgroundImage: `url(${selected.image})` }} /><div className="photo-caption"><span>{selected.eyebrow}</span><strong>{selected.label}</strong></div></div>
      </section>
    </main>
  );
}
