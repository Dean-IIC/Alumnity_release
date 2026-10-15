import type { Metadata } from "next";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import "../styles/wire.css";

export const metadata: Metadata = {
  title: "How it works · Alumnity",
  description: "How Alumnity works: who can join, what members can do, and how your details are kept private."
};

const STEPS = [
  ["Find your name in the register", "Alumnity is only for HKBK College of Engineering people. You join by finding your line in the college register: your name and USN (or your name, branch and year). No line, no account."],
  ["Confirm your email, choose a password", "We email you a six-digit code. Your email is never shown to other members."],
  ["Make your page yours", "Say what you do now, what you know, and what you're happy to help with. Every part has its own “who can see this”: everyone, your batch, your connections, or only you."],
  ["Connect", "Start with your batch. A request can carry a note; the other person accepts or quietly declines. Connections can message each other."],
  ["Ask a senior", "Students' questions go to a few alumni who fit them, never to everyone. One takes it on and writes back privately. When it helped, the thanks goes on their Record."],
  ["Stay in touch", "Home is a noticeboard of notes from your batch and connections. Events are put up by the college; say you're coming and add them to your calendar."]
] as const;

const SAFETY = [
  "Your email and USN are never shown to other members.",
  "You choose who sees each part of your page.",
  "Block anyone: you won't see each other anywhere, and they aren't told.",
  "Report anything to the college's alumni coordinators, who can take it down.",
  "Connection requests and messages are limited per day, so nobody can spam.",
  "You can delete your account at any time, from Settings."
];

/** For visitors: what Alumnity is, how joining works, and how it keeps people safe. */
export default function HowItWorks() {
  return (
    <>
      <SiteHeader />
      <main className="wf container">
        <header className="wf-head">
          <h1>How Alumnity works</h1>
          <p className="wf-muted">A private network for the students, alumni and faculty of HKBK College of Engineering.</p>
        </header>
        <ol className="wf-list">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="wf-card">
              <p>
                <strong>
                  {i + 1}. {title}
                </strong>
              </p>
              <p className="wf-muted">{text}</p>
            </li>
          ))}
        </ol>
        <h2>Keeping it safe</h2>
        <ul className="wf-checklist">
          {SAFETY.map((s) => (
            <li key={s} className="done">
              {s}
            </li>
          ))}
        </ul>
        <div className="wf-actions" style={{ marginTop: "var(--space-7)" }}>
          <a className="button button--primary" href="/join">
            Join now <span aria-hidden="true">→</span>
          </a>
          <a className="button button--secondary" href="/login">
            Log in
          </a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
