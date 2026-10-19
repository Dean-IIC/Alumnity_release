"use client";

import { useEffect, useRef } from "react";

/*
 * The college register, on a tablet. While someone is being looked up, records stream
 * past and a marigold scan line sweeps up and down over them, like a database search.
 * When they're found, the line stops on a highlighted row, their line is written into it
 * and a green "On the register" stamp lands. When they aren't found, a red "Not found"
 * stamp lands over the stopped list.
 *
 * The records that stream past are made up here, in the browser, from a fixed seed: they
 * are never real register data (the server only ever sends back the one line that matched).
 * Their names are scrambled and blurred, and their USNs masked, so nobody mistakes them
 * for real people.
 *
 * All motion is CSS (app/styles/join-scan.css). With reduced motion the panel just shows
 * each state, still.
 */

export type BookState = "idle" | "searching" | "found" | "not-found";

export type BookLine = { name: string; usn: string; branch: string; joined: number };

/** How many made-up records stream past (drawn twice, so the loop has no seam). */
const FAKE_ROWS = 12;
const BRANCHES = ["CS", "EC", "ME", "CV", "EE", "IS", "AI", "TE"];
const LETTERS = "abcdefghiklmnoprstuvy";

/** A small fixed-seed number generator: the same rows on the server and in the browser. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Gibberish shaped like a name: two scrambled words, nobody's. */
function scrambled(next: () => number) {
  const word = (length: number) => {
    let w = "";
    for (let i = 0; i < length; i++) w += LETTERS[Math.floor(next() * LETTERS.length)];
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  return `${word(4 + Math.floor(next() * 4))} ${word(5 + Math.floor(next() * 5))}`;
}

type FakeRow = { usn: string; name: string; branch: string; joined: number };

const FAKES: FakeRow[] = (() => {
  const next = seeded(1997);
  return Array.from({ length: FAKE_ROWS }, () => {
    const branch = BRANCHES[Math.floor(next() * BRANCHES.length)];
    return {
      // Masked: the shape of a USN, never one.
      usn: `1HK••${branch}•••`,
      name: scrambled(next),
      branch,
      joined: 1998 + Math.floor(next() * 27)
    };
  });
})();

/** What the panel's status chip says, for joining and for logging in. */
const STATUS = {
  join: { idle: "Ready to search", searching: "Searching the register…", found: "1 record found", "not-found": "No match" },
  login: { idle: "Your page is in here", searching: "Checking…", found: "Signed in", "not-found": "Not signed in" }
} as const;

export function RegisterBook({
  state,
  line,
  tone = "join",
  reveal = false
}: {
  state: BookState;
  line?: BookLine;
  /** "login": a calmer panel (slow scan when idle, "checking" while signing in). */
  tone?: "join" | "login";
  /** Bring the panel into view when a search starts (on a phone it sits above the form, out of sight). */
  reveal?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);

  // On a phone the panel is above the form, and the button that starts the search is at the
  // form's foot: by the time the result lands, the panel had scrolled out of sight above.
  // So when a search starts, scroll just enough to show it (never on a wide screen, where
  // it's already beside the form).
  useEffect(() => {
    if (!reveal || state !== "searching" || !panel.current) return;
    const box = panel.current.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= window.innerHeight) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.current.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [reveal, state]);

  const row = (r: FakeRow, key: string) => (
    <li key={key} className="register-scan__row">
      <span className="register-scan__usn">{r.usn}</span>
      <span className="register-scan__name">{r.name}</span>
      <span>{r.branch}</span>
      <span>{r.joined}</span>
    </li>
  );

  return (
    <figure ref={panel} className={`register-scan register-scan--${state} register-scan--${tone}`} aria-hidden="true">
      <div className="register-scan__screen">
        <header className="register-scan__head">
          <span className="register-scan__title">HKBK College of Engineering</span>
          <span className="register-scan__sub">Register of students · since 1998</span>
          <span className="register-scan__status">{STATUS[tone][state]}</span>
        </header>
        <div className="register-scan__columns">
          <span>USN</span>
          <span>Name</span>
          <span>Branch</span>
          <span>Joined</span>
        </div>
        <div className="register-scan__window">
          <ol className="register-scan__stream">
            {FAKES.map((r, i) => row(r, `a${i}`))}
            {FAKES.map((r, i) => row(r, `b${i}`))}
          </ol>

          {/* The row the scan stops on: the person's own line, from the server's answer. */}
          {state === "found" && line && (
            <div className="register-scan__hit">
              <span className="register-scan__usn">{line.usn}</span>
              <span>{line.name}</span>
              <span>{line.branch}</span>
              <span>{line.joined}</span>
            </div>
          )}

          <span className="register-scan__beam" />

          {state === "found" && (
            <span className="register-scan__stamp register-scan__stamp--yes">
              {tone === "login" ? "Welcome back" : "On the register"} <span className="register-scan__tick">✓</span>
            </span>
          )}
          {state === "not-found" && (
            <span className="register-scan__stamp register-scan__stamp--no">
              Not found
              <small>Check &amp; try again</small>
            </span>
          )}
        </div>
      </div>
      {/* The tablet's camera, a dot on its frame: just enough to read as a device. */}
      <span className="register-scan__camera" />
    </figure>
  );
}
