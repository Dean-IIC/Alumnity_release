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
        <svg className="campus-sketch" viewBox="0 0 1000 620" role="img" aria-label="A pencil sketch of HKBK campus buildings">
          <g className="sketch-lines">
            <path d="M55 503C175 436 297 430 378 472S570 541 684 451s202-124 268-96" /><path d="M98 548C226 489 289 500 402 544s193 51 294-25 173-98 247-61" />
            <path d="M127 365l93-53 101 56v131l-89 46-105-50z" /><path d="M364 287l164-83 143 77v187l-147 74-160-75z" />
            <path d="M713 325l102-54 104 51v142l-104 55-102-54z" /><path d="M308 155l79-44 79 41v96l-79 42-79-41z" />
            <path d="M447 203v264M524 204v338M600 244v266M775 326v189M852 287v192" /><path d="M180 337v178M229 313v214M280 346v164M346 177v100M422 130v104" />
          </g>
          <g className="sketch-trees"><circle cx="94" cy="271" r="31" /><circle cx="152" cy="235" r="24" /><circle cx="250" cy="255" r="36" /><circle cx="706" cy="229" r="38" /><circle cx="791" cy="210" r="27" /><circle cx="912" cy="251" r="39" /><circle cx="332" cy="546" r="31" /><circle cx="450" cy="565" r="28" /><circle cx="637" cy="532" r="36" /></g>
        </svg>
        <svg className="route-line" viewBox="0 0 1000 620" aria-hidden="true"><path d="M78 533C257 477 328 485 467 503s265-80 354-194" /><circle cx="78" cy="533" r="7" /><circle cx="467" cy="503" r="7" /><circle cx="821" cy="309" r="8" /></svg>
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
