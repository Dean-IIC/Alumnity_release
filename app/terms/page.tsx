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
  description: "Alumnity’s rules: who can join, how to treat each other, causes and donations."
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
            Last updated {LEGAL.updated}. When you join Alumnity, you agree to these terms and the <Link href="/privacy">privacy policy</Link>.
          </p>
        </header>
        {!legalReady() && <p className="wf-card">Draft: the college will check these terms before Alumnity opens to everyone.</p>}

        <Section title="Who it's for">
          <ul>
            <li>Alumnity is {LEGAL.fiduciary}’s network for its students, alumni and faculty.</li>
            <li>You must be 18 or over.</li>
            <li>You join with your own entry in the college register.</li>
            <li>Each person may have only one account.</li>
            <li>Don’t join as anyone else.</li>
            <li>Don’t share your account, and don’t let anyone else use it.</li>
          </ul>
        </Section>

        <Section title="How we treat each other">
          <ul>
            <li>Be respectful. No harassment, bullying, threats, hate, or sexual content.</li>
            <li>Be honest about who you are and what you do.</li>
            <li>Respect privacy. Don’t share other people’s personal details, messages or photos unless they agree.</li>
            <li>No spam, scams or chain messages. Don’t try to sell to people who didn’t ask for it.</li>
            <li>Real job posts and referrals are welcome.</li>
            <li>Post only what you have the right to post. Never post anything illegal (against the law).</li>
          </ul>
          <p>Anyone can report something to the college desk.</p>
          <p>The desk may remove anything that breaks these rules. It may also pause or remove accounts.</p>
          <p>Everything the desk does is saved in an audit log (a list of its actions). If you think the desk made a mistake, write to {contact}.</p>
        </Section>

        <Section title="What you post">
          <p>What you post stays yours (you still own it).</p>
          <p>You allow the college to show it on Alumnity. It is shown to the people you shared it with.</p>
          <p>This lasts as long as you keep it there. If you delete it, or delete your account, it is removed.</p>
        </Section>

        <Section title="Causes and donations">
          <ul>
            <li>Anyone may suggest a cause (something to raise money for). It goes on Alumnity only after the college desk approves it.</li>
            <li>The desk may ask questions, say no to a cause, or close it.</li>
            <li>Tell the truth about a cause. Say who it helps and what the money is for.</li>
            <li>A cause that misleads people will be closed.</li>
            <li>Every donation is paid to {LEGAL.fiduciary}, through Razorpay. So the money goes to the college first.</li>
            <li>The college pays it out for the cause (it uses the money for that cause). It lists each payout on the cause’s page.</li>
            <li>A cause may close before all its money is used. Then the college uses the rest for a similar purpose.</li>
            <li>Donations are voluntary (you choose to give; nobody has to). Once you donate, you can’t take it back.</li>
            <li>The only exception is a payment made by mistake. If that happens, write to {contact}.</li>
            <li>You can get a tax receipt for a donation only if the college gives one. Alumnity itself doesn’t give receipts.</li>
          </ul>
        </Section>

        <Section title="The site itself">
          <ul>
            <li>We work to keep Alumnity running and safe.</li>
            <li>But it’s offered “as it is” (we can’t promise it will always work perfectly).</li>
            <li>Sometimes you may not be able to use it.</li>
            <li>The college isn’t responsible for what members post.</li>
            <li>It also isn’t responsible for what members arrange between themselves. For example, a job, a referral or a meeting.</li>
            <li>Use your own good sense. Report anything that seems wrong.</li>
          </ul>
        </Section>

        <Section title="Changes, and the law">
          <p>If we make an important change to these terms, we’ll tell members. We’ll do it before the change starts.</p>
          <p>These terms are governed by the laws of India (Indian law applies to them).</p>
          <p>The courts at Bengaluru have jurisdiction (they can hear any legal case about these terms).</p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
