"use client";


import Link from "next/link";
import { useEffect, useState } from "react";
import { readIntroPreference, writeIntroPreference } from "../lib/intro-preference";
import { COLLEGE_NAME } from "./brand-lockup";
import { ABOUT_LINKS } from "../lib/footer-links";

/** The page's foot: who it is for, and the intro setting (the intro's own checkbox writes the same). */
/** `app`: inside the signed-in pages, where the intro's setting doesn't belong. */
export function SiteFooter({ app = false }: { app?: boolean }) {
  const [playIntro, setPlayIntro] = useState(true);

  useEffect(() => setPlayIntro(readIntroPreference() === "play"), []);

  return (
    <footer className="site-footer container">
      <div className="site-footer__main">
        <p className="site-footer__for">Alumnity · for students and alumni of {COLLEGE_NAME}</p>
        <nav className="site-footer__links" aria-label="About Alumnity">
          {ABOUT_LINKS.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {!app && <div className="site-footer__intro">
        <label>
          <input
            type="checkbox"
            checked={playIntro}
            onChange={(event) => {
              setPlayIntro(event.target.checked);
              writeIntroPreference(event.target.checked ? "play" : "skip");
            }}
          />
          Play the intro when I visit
        </label>
        {/* A full load: the intro is chosen by the script in <head>, which a page swap skips. */}
        <a href="/?intro=1">Watch it now <span aria-hidden="true">↺</span></a>
      </div>}
    </footer>
  );
}
