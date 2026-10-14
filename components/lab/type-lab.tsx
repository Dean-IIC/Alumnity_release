"use client";

import { useState, type CSSProperties } from "react";
import { HERO_PHOTO } from "../../lib/campus";

export type Pairing = { id: string; name: string; note: string; voice: string; ui: string };

type Copy = { id: string; kicker: string; headline: string; text: string; primary: string; secondary: string; why: string };

/*
 * Hero copy to try. Built on what Alumnity actually does (README §4): a student asks a
 * specific question, it reaches the few seniors who can answer, one backs it, and the
 * help lands on that senior's Record. Joining is checked against the college register.
 */
const COPY: Copy[] = [
  {
    id: "now",
    kicker: "HKBK College of Engineering · Alumni",
    headline: "Stay connected to where it began.",
    text: "A network for HKBK people to ask, guide and grow — together.",
    primary: "Find your place",
    secondary: "I’m already here",
    why: "What we have now: warm, but it doesn’t say what you can do here."
  },
  {
    id: "ask",
    kicker: "For HKBK CE students and alumni",
    headline: "Ask a senior who’s been exactly there.",
    text: "Bring a specific question — placements, a project, your first job. Alumnity finds the HKBK seniors who can actually answer it.",
    primary: "Ask your first question",
    secondary: "I’m an alumnus",
    why: "Leads with the student’s need and the one thing you do here: ask."
  },
  {
    id: "seniors",
    kicker: "HKBK College of Engineering · Alumni",
    headline: "Your seniors never really left.",
    text: "Ask the HKBK engineers who sat in your classrooms. One of them will take your question on and see you through it.",
    primary: "Join with your USN",
    secondary: "Sign in",
    why: "Emotional and specific: the people who were in your seat are still reachable."
  },
  {
    id: "every",
    kicker: "Students ask · Alumni answer",
    headline: "Every question finds the right senior.",
    text: "Students ask. The few alumni who’ve solved it answer. Every answer goes on their Record — so helping a junior counts.",
    primary: "Join with your USN",
    secondary: "Sign in",
    why: "Explains the whole loop, for both sides, in two lines."
  },
  {
    id: "next",
    kicker: "HKBK College of Engineering · Alumni",
    headline: "From one HKBK engineer to the next.",
    text: "Ask what you’re stuck on. Answer what you’ve been through. Checked against the college’s own records, so you always know who you’re talking to.",
    primary: "Join with your USN",
    secondary: "Sign in",
    why: "Continuity across batches, plus trust: everyone is verified."
  },
  {
    id: "stuck",
    kicker: "For HKBK CE students",
    headline: "Stuck? Someone from HKBK has been there.",
    text: "Ask a specific question and Alumnity takes it to the seniors who can answer it — from your branch, your batch, your city.",
    primary: "Ask a senior",
    secondary: "I’m an alumnus — give back",
    why: "Most direct: names the moment you’d come here, and both doors."
  }
];

function Hero({ pairing, copy }: { pairing: Pairing; copy: Copy }) {
  return (
    <div className="lab-hero" style={{ "--voice": pairing.voice, "--ui": pairing.ui } as CSSProperties}>
      <div className="lab-hero__copy">
        <p className="lab-hero__kicker">{copy.kicker}</p>
        <h2 className="lab-hero__headline">{copy.headline}</h2>
        <p className="lab-hero__text">{copy.text}</p>
        <div className="lab-hero__actions">
          <span className="lab-button lab-button--primary">{copy.primary} →</span>
          <span className="lab-button lab-button--secondary">{copy.secondary} →</span>
        </div>
      </div>
      <figure className="lab-hero__photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_PHOTO.src} alt="" />
        <figcaption>
          <span>Campus</span>
          <em>D Block at sunset</em>
        </figcaption>
      </figure>
    </div>
  );
}

function Chips<T extends { id: string }>({ items, value, onChange, label }: { items: T[]; value: string; onChange: (id: string) => void; label: (item: T) => string }) {
  return (
    <div className="lab-chips" role="radiogroup">
      {items.map((item) => (
        <button key={item.id} type="button" role="radio" aria-checked={item.id === value} className="lab-chip" onClick={() => onChange(item.id)}>
          {label(item)}
        </button>
      ))}
    </div>
  );
}

export function TypeLab({ pairings }: { pairings: Pairing[] }) {
  const [copyForFonts, setCopyForFonts] = useState("ask");
  const [pairingForCopy, setPairingForCopy] = useState("dm");
  const fontCopy = COPY.find((c) => c.id === copyForFonts) ?? COPY[0];
  const copyPairing = pairings.find((p) => p.id === pairingForCopy) ?? pairings[0];

  return (
    <main className="lab container">
      <header className="lab__intro">
        <p className="lab__eyebrow">Alumnity design lab · development only</p>
        <h1>Fonts and hero copy, side by side</h1>
        <p>Each card is the real hero layout at a smaller size. Use the toggles to try any copy in any pairing.</p>
      </header>

      <section className="lab__section">
        <div className="lab__section-head">
          <h2>At a glance</h2>
          <p>All six pairings with the same copy (pick it in section 1).</p>
        </div>
        <div className="lab-glance">
          {pairings.map((pairing, i) => (
            <div className="lab-glance__tile" key={pairing.id} style={{ "--voice": pairing.voice, "--ui": pairing.ui } as CSSProperties}>
              <span className="lab-glance__name">{String.fromCharCode(65 + i)} · {pairing.name}</span>
              <p className="lab-hero__kicker">{fontCopy.kicker}</p>
              <p className="lab-glance__headline">{fontCopy.headline}</p>
              <p className="lab-glance__text">{fontCopy.text}</p>
              <span className="lab-button lab-button--primary">{fontCopy.primary} →</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lab__section">
        <div className="lab__section-head">
          <h2>1 · Font pairings</h2>
          <p>Showing copy:</p>
          <Chips items={COPY} value={copyForFonts} onChange={setCopyForFonts} label={(c) => c.headline} />
        </div>
        {pairings.map((pairing, i) => (
          <article className="lab-card" key={pairing.id}>
            <header>
              <strong>{String.fromCharCode(65 + i)} · {pairing.name}</strong>
              <span>{pairing.note}</span>
            </header>
            <Hero pairing={pairing} copy={fontCopy} />
          </article>
        ))}
      </section>

      <section className="lab__section">
        <div className="lab__section-head">
          <h2>2 · Hero copy</h2>
          <p>Set in:</p>
          <Chips items={pairings} value={pairingForCopy} onChange={setPairingForCopy} label={(p) => p.name} />
        </div>
        {COPY.map((copy, i) => (
          <article className="lab-card" key={copy.id}>
            <header>
              <strong>{i + 1} · “{copy.headline}”</strong>
              <span>{copy.why}</span>
            </header>
            <Hero pairing={copyPairing} copy={copy} />
          </article>
        ))}
      </section>
    </main>
  );
}
