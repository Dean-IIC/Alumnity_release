import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { LEGAL, legalReady } from "../../lib/legal";
import "../styles/wire.css";

export const metadata: Metadata = {
  title: "Privacy · Alumnity",
  description: "What Alumnity keeps about you, why, who can see it, and your rights over it."
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="wf-prose">
    <h2>{title}</h2>
    {children}
  </section>
);

const contact = LEGAL.contactEmail ? <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> : "the alumni office (address to be added)";

/** The privacy policy, written to match what the site actually does (lib/server). */
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="wf container">
        <header className="page-head legal-head">
          <p className="kicker">Privacy policy</p>
          <h1 className="page-title">
            Your details, <span className="page-title__gold">kept safe.</span>
          </h1>
          <p className="page-head__text">What Alumnity keeps about you, why, who can see it, and your rights over it. Last updated {LEGAL.updated}.</p>
        </header>
        {!legalReady() && <p className="wf-card">Draft: the college is completing its contact details and reviewing this policy before Alumnity opens to everyone.</p>}

        <Section title="Who we are">
          <p>
            Alumnity is run by {LEGAL.fiduciary}
            {LEGAL.address ? `, ${LEGAL.address}` : ""} (“the college”, “we”). Under India’s Digital Personal Data Protection Act, 2023, the college is the data fiduciary for
            what you share here. Write to {contact} about anything in this policy.
          </p>
        </Section>

        <Section title="What we keep, and why">
          <ul>
            <li>
              <strong>Your entry in the college register</strong> (name, USN, branch, course, the year you joined), from the college’s own records. It’s how we know you studied
              here; it’s never shown to anyone in full. Signed-in members can search it for someone’s name, to invite them: they see a name, branch and year, never a USN, and only a few searches an hour, so it can’t be copied out.
            </li>
            <li>
              <strong>Your email address</strong>, to sign you in and send your codes (and, if you leave it on, one daily email when something’s waiting). Other members never see it.
            </li>
            <li>
              <strong>Your password</strong>, kept only as a one-way scrambled form by our sign-in provider. Nobody, including the college, can read it.
            </li>
            <li>
              <strong>What you put on your page</strong>: what you do now, your journey, skills, links, a photo and a cover. You choose who sees each part.
            </li>
            <li>
              <strong>What you do here</strong>: posts, comments, reactions, stories (gone after a day), messages, Asks, groups, events you’re going to, connections, follows and blocks.
            </li>
            <li>
              <strong>Photos and videos you upload.</strong> Hidden details inside photos (such as where they were taken) are removed when you upload them.
            </li>
            <li>
              <strong>Donations</strong>: which cause, how much, when, and the payment’s reference from Razorpay. Your card, UPI or bank details go to Razorpay, never to us.
            </li>
            <li>
              <strong>Running the site safely</strong>: when you were last here (to the hour), the browsers you’re signed in on, and, for a day, the network addresses of recent
              attempts, so nobody can guess passwords or spam. If you turn on notifications, your browser’s notification address.
            </li>
          </ul>
          <p>
            We use all this only to run Alumnity for HKBK’s students and alumni: to verify who joins, show your page and what you share to the people you chose, deliver messages
            and notifications, keep members safe, and handle donations. We don’t sell it, rent it, or use it for advertising, and there are no advertising or tracking cookies:
            the only cookies keep you signed in.
          </p>
        </Section>

        <Section title="Who can see it">
          <ul>
            <li>Other members see only what you share, with whom you chose (everyone, your batch, your connections, a group, or only you). People who aren’t members see nothing.</li>
            <li>Messages are seen only by you and the person you’re writing to. A message reported to the college desk is seen by the desk.</li>
            <li>
              The college desk (the alumni office’s coordinators and administrators) can see members’ details, what’s been reported, and donations, to keep the site safe and
              account for money. Everything they do is recorded in an audit log.
            </li>
            <li>
              If you give to a cause, your name is shown with your gift unless you choose not to be named; the amount is shown only to you and the college.
            </li>
          </ul>
        </Section>

        <Section title="The services that help us run it">
          <p>
            These handle data for us, only to run Alumnity: Supabase (the database, sign-in and file storage), Vercel (the website’s servers), Razorpay (payments), our email
            provider (the daily email), and your browser maker’s notification service (if you turn notifications on). Some of these may keep data outside India; they’re bound
            to protect it.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            As long as you have an account. Delete your account in Settings and your page, posts, comments, messages, uploads and everything else of yours goes, for good. A
            record that a donation was made (without your name) is kept as long as the law requires the college to keep its accounts; the desk’s audit log keeps that an
            action happened.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can see and correct what’s on your page at any time, choose who sees it, turn off emails and notifications, and delete your account. You may also ask the college
            for a summary of what it holds about you, to correct or erase it, to name someone to act for you, and to complain: write to {contact}
            {LEGAL.grievanceOfficer ? `. The grievance officer is ${LEGAL.grievanceOfficer}` : ""}. If you aren’t satisfied with the answer, you can go to the Data Protection Board
            of India.
          </p>
        </Section>

        <Section title="Age">
          <p>Alumnity is for people aged 18 or over. If you’re a student under 18, please wait until you turn 18 to join.</p>
        </Section>

        <Section title="Keeping it secure">
          <p>
            Everything travels encrypted. Passwords are never stored readably. Only the site’s own server can reach the database. Uploads are checked, and every file is served
            only to signed-in members who may see it. Tell {contact} at once if you think something is wrong.
          </p>
        </Section>

        <Section title="Changes">
          <p>If this policy changes in a way that matters, we’ll tell members on Alumnity before it applies.</p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
