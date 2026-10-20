import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackLink } from "../../components/back-link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { LEGAL, legalReady } from "../../lib/legal";
import "../styles/wire.css";

export const metadata: Metadata = {
  title: "Privacy · Alumnity",
  description: "What Alumnity keeps about you, and why. Who can see it, and your rights."
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
          <p className="page-head__text">What we keep about you, and why. Who can see it, and your rights. Last updated {LEGAL.updated}.</p>
        </header>
        {!legalReady() && (
          <p className="wf-card">Draft: the college is still adding its contact details. It will also check this policy before Alumnity opens to everyone.</p>
        )}

        <Section title="Who we are">
          <p>
            Alumnity is run by {LEGAL.fiduciary}
            {LEGAL.address ? `, ${LEGAL.address}` : ""} (“the college”, “we”).
          </p>
          <p>India has a law to protect personal data. It is the Digital Personal Data Protection Act, 2023.</p>
          <p>
            Under this law, the college is the data fiduciary (the one in charge of your data) for what you share here. It decides why and how your data is used,
            and it must keep it safe.
          </p>
          <p>Write to {contact} about anything in this policy.</p>
        </Section>

        <Section title="What we keep, and why">
          <ul>
            <li>
              <strong>Your entry in the college register</strong> (name, USN, branch, course, the year you joined).
              <ul>
                <li>It comes from the college’s own records.</li>
                <li>We use it to check that you studied here.</li>
                <li>It’s never shown to anyone in full.</li>
                <li>Logged-in members can search it by name to invite someone.</li>
                <li>They see only a name, branch and year. They never see a USN.</li>
                <li>They can do only a few searches an hour. So nobody can copy the register.</li>
              </ul>
            </li>
            <li>
              <strong>Your email address.</strong> We use it to log you in and send your codes.
              <ul>
                <li>If you leave daily emails on, we send you one email a day. We send it only when something is waiting for you.</li>
                <li>Other members never see your email address.</li>
              </ul>
            </li>
            <li>
              <strong>Your password.</strong> Our login service keeps it only in a scrambled form. That form can’t be turned back into your password.
              Nobody, not even the college, can read it.
            </li>
            <li>
              <strong>What you put on your page.</strong> You choose who sees each part.
              <ul>
                <li>What you do now</li>
                <li>Your journey</li>
                <li>Your skills and links</li>
                <li>A photo and a cover</li>
              </ul>
            </li>
            <li>
              <strong>What you do here:</strong>
              <ul>
                <li>Posts, comments and reactions</li>
                <li>Stories (they disappear after a day)</li>
                <li>Messages</li>
                <li>Questions in Ask a senior</li>
                <li>Groups, and events you’re going to</li>
                <li>Connections, follows and blocks</li>
              </ul>
            </li>
            <li>
              <strong>Photos and videos you upload.</strong> Photos can hold hidden details, such as where they were taken. We remove these when you upload them.
            </li>
            <li>
              <strong>Donations:</strong> which cause, how much, and when. Also the payment’s reference from Razorpay.
              <ul>
                <li>Your card, UPI or bank details go to Razorpay, never to us.</li>
              </ul>
            </li>
            <li>
              <strong>Keeping the site safe:</strong>
              <ul>
                <li>When you last visited (to the nearest hour).</li>
                <li>The browsers you’re logged in on.</li>
                <li>
                  The network addresses of recent tries, such as tries to log in. We keep these for one day. This is so nobody can guess passwords or send spam.
                </li>
                <li>If you turn on notifications: your browser’s notification address.</li>
              </ul>
            </li>
          </ul>
          <p>We use all this only to run Alumnity for HKBK’s students and alumni. We use it to:</p>
          <ul>
            <li>check who joins</li>
            <li>show your page and what you share to the people you chose</li>
            <li>deliver messages and notifications</li>
            <li>keep members safe</li>
            <li>handle donations.</li>
          </ul>
          <p>We don’t sell it, rent it or use it for advertising.</p>
          <p>
            There are no advertising or tracking cookies (small files sites save in your browser). The only cookies are the ones that keep you logged in.
          </p>
        </Section>

        <Section title="Who can see it">
          <ul>
            <li>
              Other members see only what you share with them. You choose who: everyone, your batch, your connections, a group, or only you.
            </li>
            <li>People who aren’t members see nothing.</li>
            <li>
              Only you and the person you’re writing to can see your messages. If someone reports a message to the college desk, the desk can see it.
            </li>
            <li>
              The college desk can see members’ details, reports and donations. The desk is the alumni office’s coordinators and administrators.
            </li>
            <li>The desk needs this to keep the site safe and keep track of money.</li>
            <li>Everything the desk does is saved in an audit log (a list of its actions).</li>
            <li>If you donate to a cause, your name is shown with your donation. You can choose not to be named.</li>
            <li>Only you and the college can see how much you gave.</li>
          </ul>
        </Section>

        <Section title="The services that help us run it">
          <p>These services handle data for us, only to run Alumnity:</p>
          <ul>
            <li>Supabase: the database, login and file storage</li>
            <li>Vercel: the website’s servers</li>
            <li>Razorpay: payments</li>
            <li>Our email service: the daily email</li>
            <li>Your browser maker’s notification service, if you turn notifications on.</li>
            <li>
              Poolside (its Laguna AI), only when you press an AI helper: “Find with AI” on Network, “Help me ask” on Ask a senior, or “Help me write” on a post. It gets
              only the words you typed into that box, never your page, your messages or the college register. It only suggests; nothing is posted or sent
              unless you do it yourself.
            </li>
          </ul>
          <p>Some of them may keep data outside India. They must protect it.</p>
        </Section>

        <Section title="How long we keep it">
          <p>We keep it as long as you have an account.</p>
          <p>You can delete your account in Settings. Then all of this is deleted for good:</p>
          <ul>
            <li>your page</li>
            <li>your posts and comments</li>
            <li>your messages</li>
            <li>your uploads</li>
            <li>everything else of yours.</li>
          </ul>
          <p>These records stay:</p>
          <ul>
            <li>
              A record that a donation was made, without your name. The law says how long the college must keep its accounts. This record stays that long.
            </li>
            <li>The desk’s audit log keeps a record that an action happened.</li>
          </ul>
        </Section>

        <Section title="Your rights">
          <p>At any time, you can:</p>
          <ul>
            <li>see and correct what’s on your page</li>
            <li>choose who sees it</li>
            <li>turn off emails and notifications</li>
            <li>delete your account.</li>
          </ul>
          <p>You may also:</p>
          <ul>
            <li>ask the college for a summary of what it holds about you</li>
            <li>ask it to correct or erase (delete) that data</li>
            <li>name someone to act for you</li>
            <li>make a complaint.</li>
          </ul>
          <p>To do any of these, write to {contact}.</p>
          {LEGAL.grievanceOfficer && (
            <p>
              The grievance officer (the person who deals with complaints about your data) is {LEGAL.grievanceOfficer}.
            </p>
          )}
          <p>
            Not happy with the answer? You can go to the Data Protection Board of India. (The government set it up under this law to hear complaints.)
          </p>
        </Section>

        <Section title="Age">
          <p>Alumnity is for people aged 18 or over. If you’re a student under 18, please wait until you’re 18 to join.</p>
        </Section>

        <Section title="Keeping it safe">
          <ul>
            <li>Everything is sent encrypted (locked, so nobody else can read it on the way).</li>
            <li>Passwords are never stored in a form anyone can read.</li>
            <li>Only the site’s own server can reach the database.</li>
            <li>We check uploads.</li>
            <li>Each file is shown only to logged-in members allowed to see it.</li>
          </ul>
          <p>If you think something is wrong, tell {contact} right away.</p>
        </Section>

        <Section title="Changes">
          <p>If we make an important change to this policy, we’ll tell members on Alumnity. We’ll do it before the change starts.</p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
