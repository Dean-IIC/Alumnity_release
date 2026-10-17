import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { LEGAL, legalReady } from "../../lib/legal";
import "../styles/wire.css";

export const metadata: Metadata = {
  title: "Terms · Alumnity",
  description: "The rules of Alumnity: who can join, how to treat each other, causes and donations."
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="wf-prose">
    <h2>{title}</h2>
    {children}
  </section>
);

const contact = LEGAL.contactEmail ? <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> : "the alumni office (address to be added)";

/** The terms of use: plain rules for a college community. */
export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="wf container">
        <header className="wf-head">
          <h1>Terms of use</h1>
          <p className="wf-muted">Last updated {LEGAL.updated}. By joining Alumnity you agree to these terms and to the <a href="/privacy">privacy policy</a>.</p>
        </header>
        {!legalReady() && <p className="wf-card">Draft: the college is reviewing these terms before Alumnity opens to everyone.</p>}

        <Section title="Who it's for">
          <p>
            Alumnity is {LEGAL.fiduciary}’s network for its students, alumni and faculty, aged 18 or over. You join with your own entry in the college register; one person,
            one account. Don’t join as anyone else, share your account, or let anyone else use it.
          </p>
        </Section>

        <Section title="How we treat each other">
          <ul>
            <li>Be respectful. No harassment, bullying, threats, hate, or sexual content.</li>
            <li>Be honest about who you are and what you do.</li>
            <li>Respect privacy: don’t share other people’s personal details, messages or photos without their agreement.</li>
            <li>No spam, scams, chain messages, or selling to people who didn’t ask. Job posts and referrals are welcome when they’re real.</li>
            <li>Post only what you have the right to post, and nothing illegal.</li>
          </ul>
          <p>
            Anyone can report something to the college desk. The desk may take down what breaks these rules and pause or remove accounts, and is recorded in an audit log when it
            does. If you think the desk got it wrong, write to {contact}.
          </p>
        </Section>

        <Section title="What you post">
          <p>
            What you post stays yours. You let the college show it on Alumnity to the people you shared it with, for as long as you keep it there. Delete it, or your account,
            and it goes.
          </p>
        </Section>

        <Section title="Causes and donations">
          <ul>
            <li>Anyone may propose a cause. It goes live only once the college desk approves it; the desk may ask questions, decline, or close a cause.</li>
            <li>Tell the truth about a cause: who it helps and what the money is for. A misleading cause will be closed.</li>
            <li>
              Every donation is paid to {LEGAL.fiduciary}, through Razorpay. The college pays it out for the cause and records each payout on the cause’s page. If a cause
              closes before all its money is used, the college uses the rest for a similar purpose.
            </li>
            <li>Donations are voluntary and, once made, can’t be withdrawn, except where a payment was made in error: then write to {contact}.</li>
            <li>A donation receipt for tax purposes is available only where the college issues one; Alumnity itself doesn’t.</li>
          </ul>
        </Section>

        <Section title="The site itself">
          <p>
            We work to keep Alumnity running and safe, but it’s offered as it is: it may sometimes be unavailable, and the college isn’t responsible for what members post or
            for arrangements members make between themselves (a job, a referral, a meeting). Use your judgement, and report anything that seems wrong.
          </p>
        </Section>

        <Section title="Changes, and the law">
          <p>
            If these terms change in a way that matters, we’ll tell members before it applies. These terms are governed by the laws of India, and the courts at Bengaluru have
            jurisdiction.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
