import Link from "next/link";
import { COLLEGE, COLLEGE_LINKS } from "../lib/college";
import { LOGO } from "./brand-lockup";

/** The network's own pages. */
const NETWORK_LINKS = [
  ["Join the network", "/join"],
  ["Log in", "/login"],
  ["How it works", "/how-it-works"],
  ["Alumni community", "/community"],
  ["Gallery", "/gallery"],
  ["Committee", "/committee"],
  ["About the network", "/about"],
  ["Developers", "/developers"]
] as const;

/**
 * The foot of every page, as the college site's: navy, the crest and address, the
 * network's pages, the college's own quick links (on hkbkce.in), and the legal line.
 * `app`: inside the signed-in pages (kept for the callers; the footer is the same).
 */
export function SiteFooter({ app = false }: { app?: boolean }) {
  return (
    <footer className={`site-footer ${app ? "site-footer--app" : ""}`}>
      <div className="container site-footer__grid">
        <div className="site-footer__college">
          <div className="site-footer__crest">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="" width={56} height={56} loading="lazy" />
            <span>
              <strong>{COLLEGE.name}</strong>
              <em>{COLLEGE.motto}</em>
            </span>
          </div>
          <address>
            {COLLEGE.address.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
          <a href={COLLEGE.directions} target="_blank" rel="noopener noreferrer">
            Get directions <span aria-hidden="true">↗</span>
          </a>
        </div>
        <nav aria-label="Alumni network">
          <h2>Alumni network</h2>
          <ul>
            {NETWORK_LINKS.map(([label, href]) => (
              <li key={href}>
                <Link href={href}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="HKBK College of Engineering">
          <h2>The college</h2>
          <ul>
            {COLLEGE_LINKS.map(([label, href]) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="site-footer__legal">
        <div className="container site-footer__legal-inner">
          <span>
            © {new Date().getFullYear()} {COLLEGE.name}. Established {COLLEGE.established}.
          </span>
          <span>
            {COLLEGE.affiliation} · {COLLEGE.approval}
          </span>
          <span className="site-footer__legal-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={`${COLLEGE.site}/contact`} target="_blank" rel="noopener noreferrer">
              Contact
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
