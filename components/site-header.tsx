"use client";

import { BrandLockup } from "./brand-lockup";
import { soon } from "./coming-soon";

type SiteHeaderProps = {
  /** The landing page: the header lies over the hero, and the intro lands its lockup on this one. */
  landing?: boolean;
  /** The section this page belongs to, marked in the nav. */
  current?: "gallery";
};

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/people", label: "Explore people" },
  { href: "/gallery", label: "Gallery", section: "gallery" }
] as const;

/** The one header every page shares: the lockup home, the sections, and Log in. */
export function SiteHeader({ landing = false, current }: SiteHeaderProps) {
  return (
    <header className={`site-nav container ${landing ? "site-nav--over-hero" : ""}`}>
      <a className="site-nav__brand" href={landing ? "#welcome" : "/"} aria-label="Alumnity by HKBK College of Engineering, home">
        <BrandLockup data-brand-target={landing || undefined} />
      </a>
      <nav aria-label="Primary navigation">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={soon}
            aria-current={"section" in link && link.section === current ? "page" : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <a className="sign-in" href="/login" onClick={soon}>
        Log in <span aria-hidden="true">↗</span>
      </a>
    </header>
  );
}
