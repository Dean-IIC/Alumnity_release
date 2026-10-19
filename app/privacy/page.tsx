import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackLink } from "../../components/back-link";
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
        <BackLink fallback="/" label="Back" />
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
              <strong>Your entry in the college register</strong> (name, USN, branch, course, the year you joined). It comes from the college’s own records. We use it to check
              that you studied here. It’s never shown to anyone in full. Logged-in members can search it by name to invite someone. They see only a name, branch and year, never a
              USN. They can do only a few searches an hour, so nobody can copy the register.
            </li>
            <li>
              <strong>Your email address</strong>, to log you in and send your codes. If you leave daily emails turned on, we also send you one email a day when something is
              waiting for you. Other members never see your email address.
            </li>
            <li>
              <strong>Your password</strong>. Our login provider keeps it only in a scrambled form that can’t be turned back. Nobody, including the college, can read it.
            </li>
            <li>
              <strong>What you put on your page</strong>: what you do now, your journey, skills, links, a photo and a cover. You choose who sees each part.
            </li>
            <li>
              <strong>What you do here</strong>: posts, comments, reactions, stories (they disappear after a day), messages, questions in Ask a senior, groups, events you’re going to, connections, follows and blocks.
            </li>
            <li>
              <strong>Photos and videos you upload.</strong> Hidden details inside photos (such as where they were taken) are removed when you upload them.
            </li>
            <li>
              <strong>Donations</strong>: which cause, how much, when, and the payment’s reference from Razorpay. Your card, UPI or bank details go to Razorpay, never to us.
            </li>
            <li>
              <strong>Running the site safely</strong>: when you last visited (to the nearest hour) and the browsers you’re logged in on. For one day, we also keep the network
              addresses of recent attempts (for example, attempts to log in), so that nobody can guess passwords or send spam. If you turn on notifications, we also keep your
              browser’s notification address.
            </li>
          </ul>
          <p>
            We use all this only to run Alumnity for HKBK’s students and alumni. We use it to check who joins, to show your page and what you share to the people you chose, to
            deliver messages and notifications, to keep members safe and to handle donations. We don’t sell it, rent it or use it for advertising. There are no advertising or
            tracking cookies. The only cookies are the ones that keep you logged in.
          </p>
        </Section>

        <Section title="Who can see it">
          <ul>
            <li>
              Other members see only what you share with them. You choose who that is: everyone, your batch, your connections, a group, or only you. People who aren’t members
              see nothing.
            </li>
            <li>Only you and the person you’re writing to can see your messages. If a message is reported to the college desk, the desk can see it.</li>
            <li>
              The college desk (the alumni office’s coordinators and administrators) can see members’ details, reports and donations. They need this to keep the site safe and
              to keep track of money. Everything they do is recorded in an audit log.
            </li>
            <li>
              If you donate to a cause, your name is shown with your donation, unless you choose not to be named. Only you and the college can see the amount.
            </li>
          </ul>
        </Section>

        <Section title="The services that help us run it">
          <p>
            These services handle data for us, only to run Alumnity: Supabase (the database, login and file storage), Vercel (the website’s servers), Razorpay (payments), our
            email provider (the daily email), and your browser maker’s notification service (if you turn notifications on). Some of them may keep data outside India. They are
            bound to protect it.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep it as long as you have an account. If you delete your account in Settings, your page, posts, comments, messages, uploads and everything else of yours are
            deleted for good. A record that a donation was made (without your name) is kept as long as the law requires the college to keep its accounts. The desk’s audit log
            also keeps a record that an action happened.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            At any time, you can see and correct what’s on your page, choose who sees it, turn off emails and notifications, and delete your account. You may also ask the
            college for a summary of what it holds about you. You may ask it to correct or erase that data, name someone to act for you, or make a complaint. To do any of these,
            write to {contact}
            {LEGAL.grievanceOfficer ? `. The grievance officer is ${LEGAL.grievanceOfficer}` : ""}. If you aren’t satisfied with the answer, you can go to the Data Protection Board
            of India.
          </p>
        </Section>

        <Section title="Age">
          <p>Alumnity is for people aged 18 or over. If you’re a student under 18, please wait until you turn 18 to join.</p>
        </Section>

        <Section title="Keeping it secure">
          <p>
            Everything is sent in encrypted form. Passwords are never stored in a form anyone can read. Only the site’s own server can reach the database. Uploads are checked.
            Each file is shown only to logged-in members who are allowed to see it. If you think something is wrong, tell {contact} at once.
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
