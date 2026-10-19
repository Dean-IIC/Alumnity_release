import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackLink } from "../../components/back-link";
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
        <BackLink fallback="/" label="Back" />
        <header className="page-head legal-head">
          <p className="kicker">Terms of use</p>
          <h1 className="page-title">
            How we look after <span className="page-title__gold">each other.</span>
          </h1>
          <p className="page-head__text">
            Last updated {LEGAL.updated}. By joining Alumnity you agree to these terms and to the <Link href="/privacy">privacy policy</Link>.
          </p>
        </header>
        {!legalReady() && <p className="wf-card">Draft: the college is reviewing these terms before Alumnity opens to everyone.</p>}

        <Section title="Who it's for">
          <p>
            Alumnity is {LEGAL.fiduciary}’s network for its students, alumni and faculty, aged 18 or over. You join with your own entry in the college register. Each person may
            have only one account. Don’t join as anyone else, don’t share your account, and don’t let anyone else use it.
          </p>
        </Section>

        <Section title="How we treat each other">
          <ul>
            <li>Be respectful. No harassment, bullying, threats, hate, or sexual content.</li>
            <li>Be honest about who you are and what you do.</li>
            <li>Respect privacy: don’t share other people’s personal details, messages or photos without their agreement.</li>
            <li>No spam, scams, chain messages, or selling to people who didn’t ask for it. Real job posts and referrals are welcome.</li>
            <li>Post only what you have the right to post, and nothing illegal.</li>
          </ul>
          <p>
            Anyone can report something to the college desk. The desk may remove anything that breaks these rules, and may pause or remove accounts. Everything the desk does is
            recorded in an audit log. If you think the desk made a mistake, write to {contact}.
          </p>
        </Section>

        <Section title="What you post">
          <p>
            What you post stays yours. You allow the college to show it on Alumnity to the people you shared it with, for as long as you keep it there. If you delete it, or
            delete your account, it is removed.
          </p>
        </Section>

        <Section title="Causes and donations">
          <ul>
            <li>Anyone may propose a cause. It is published only after the college desk approves it. The desk may ask questions, decline a cause, or close it.</li>
            <li>Tell the truth about a cause: who it helps and what the money is for. A misleading cause will be closed.</li>
            <li>
              Every donation is paid to {LEGAL.fiduciary}, through Razorpay. The college pays it out for the cause and records each payout on the cause’s page. If a cause
              closes before all its money is used, the college uses the rest for a similar purpose.
            </li>
            <li>Donations are voluntary. Once made, a donation can’t be withdrawn. The only exception is a payment made in error: in that case, write to {contact}.</li>
            <li>A donation receipt for tax purposes is available only if the college issues one. Alumnity itself doesn’t issue receipts.</li>
          </ul>
        </Section>

        <Section title="The site itself">
          <p>
            We work to keep Alumnity running and safe, but it’s offered as it is. It may sometimes be unavailable. The college isn’t responsible for what members post, or for
            arrangements members make between themselves (such as a job, a referral or a meeting). Use your own judgement, and report anything that seems wrong.
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
