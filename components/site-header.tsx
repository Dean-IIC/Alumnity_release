"use client";


import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLockup } from "./brand-lockup";
import { soon } from "./coming-soon";
import { MenuCloser } from "./app/menu-closer";
import { COLLEGE } from "../lib/college";

type SiteHeaderProps = {
  /** The landing page: the header lies over the hero, and the intro lands its lockup on this one. */
  landing?: boolean;
  /** The section this page belongs to, marked in the nav. */
  current?: "gallery" | "how-it-works" | "about" | "community" | "committee" | "developers";
  /** Who's signed in, when the server already knows (members' pages): no "Log in" flash. */
  member?: { firstName: string };
};

/** For visitors: what Alumnity is, the college's photos, and who's behind it. */
const LINKS = [
  { href: "/gallery", label: "Gallery", section: "gallery" },
  { href: "/how-it-works", label: "How it works", section: "how-it-works" },
  { href: "/about", label: "About", section: "about" },
  { href: "/community", label: "Alumni community", section: "community" },
  { href: "/developers", label: "Developers", section: "developers" }
] as const;

/** Signed in, on these public pages: back to your Home first. */
const MEMBER_LINKS = [{ href: "/home", label: "Your Home", section: "home" }, ...LINKS.slice(0, 3)] as const;

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
    <>
      <a className="skip-link" href="#main">
        Skip to the page
      </a>
      {/* The college's own strip, as on hkbkce.in: who it's affiliated to and approved by. */}
      <div className="college-strip">
        <div className="container college-strip__inner">
          <span>
            {COLLEGE.affiliation} <span aria-hidden="true">·</span> {COLLEGE.approval}
          </span>
          <a href={COLLEGE.site} target="_blank" rel="noopener noreferrer">
            hkbkce.in <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    <header className="site-nav-band">
    <div className={`site-nav container ${landing ? "site-nav--landing" : ""}`}>
      <a className="site-nav__brand" href={me ? "/home" : "/"} aria-label={me ? "HKBK Alumni Network, your Home" : "HKBK College of Engineering Alumni Network, home"}>
        <BrandLockup />
      </a>
      <nav aria-label="Primary navigation">
        {(me ? MEMBER_LINKS : LINKS).map((link) => (
          <a key={link.href} href={link.href} onClick={soon} aria-current={link.section === current ? "page" : undefined}>
            {link.label}
          </a>
        ))}
      </nav>
      <div className="site-nav__end">
        {me ? (
          <Link className="sign-in" href="/home">
            {me.firstName} <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <>
            <Link className="sign-in" href="/login" onClick={soon}>
              Log in
            </Link>
            <Link className="lp-btn lp-btn--gold site-nav__join" href="/join" onClick={soon}>
              Join
            </Link>
          </>
        )}
        {/* A phone: the links in a menu. */}
        <details className="site-nav__menu app-menu">
          <summary aria-label="Menu">
            <span aria-hidden="true" className="site-nav__burger" />
          </summary>
          <div className="site-nav__panel">
            {(me ? MEMBER_LINKS : LINKS).map((link) => (
              <a key={link.href} href={link.href} aria-current={link.section === current ? "page" : undefined}>
                {link.label}
              </a>
            ))}
            {!me && <Link href="/committee">Committee</Link>}
            {!me && (
              <Link href="/login" className="site-nav__panel-login">
                Log in
              </Link>
            )}
          </div>
        </details>
        <MenuCloser />
      </div>
    </div>
    </header>
    </>
  );
}
