"use client";

import { useEffect, useState } from "react";
import { BrandLockup } from "./brand-lockup";
import { soon } from "./coming-soon";

type SiteHeaderProps = {
  /** The landing page: the header lies over the hero, and the intro lands its lockup on this one. */
  landing?: boolean;
  /** The section this page belongs to, marked in the nav. */
  current?: "gallery";
  /** Who's signed in, when the server already knows (members' pages): no "Log in" flash. */
  member?: { firstName: string };
};

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/people", label: "Explore people" },
  { href: "/gallery", label: "Gallery", section: "gallery" }
] as const;

/** Signed in, the first link goes to your Home instead. */
const MEMBER_LINKS = [{ href: "/home", label: "Home" }, ...LINKS.slice(1)] as const;

/** The one header every page shares: the lockup home, the sections, and Log in. */
export function SiteHeader({ landing = false, current, member }: SiteHeaderProps) {
  // Who's signed in, asked once the page is up (so every page can stay static and fast).
  const [me, setMe] = useState<{ firstName: string } | null>(member ?? null);
  useEffect(() => {
    if (member) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch(() => undefined);
  }, [member]);

  return (
    <header className={`site-nav container ${landing ? "site-nav--over-hero" : ""}`}>
      <a className="site-nav__brand" href={landing ? "#welcome" : "/"} aria-label="Alumnity by HKBK College of Engineering, home">
        <BrandLockup data-brand-target={landing || undefined} />
      </a>
      <nav aria-label="Primary navigation">
        {(me ? MEMBER_LINKS : LINKS).map((link) => (
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
      {me ? (
        <a className="sign-in" href="/me">
          {me.firstName} <span aria-hidden="true">→</span>
        </a>
      ) : (
        <a className="sign-in" href="/login" onClick={soon}>
          Log in <span aria-hidden="true">↗</span>
        </a>
      )}
    </header>
  );
}
