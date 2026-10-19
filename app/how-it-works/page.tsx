import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";

export const metadata: Metadata = {
  title: "How it works · Alumnity",
  description: "How Alumnity works: who can join, what members can do, and how your details are kept private."
};

const STEPS = [
  ["Find your name in the register", "Alumnity is only for people from HKBK College of Engineering. To join, you find your name in the college register. Search with your name and USN, or with your name, branch and year. If you are not in the register, you cannot join."],
  ["Confirm your email, choose a password", "We email you a six-digit code. Your email is never shown to other members."],
  ["Set up your page", "Add what you do now, what you know and what you can help with. For each part of your page, you choose who can see it: everyone, your batch, your connections or only you."],
  ["Connect", "Start with your batch. You can add a short note to a connection request. The other person can accept it or decline it. Once connected, you can message each other."],
  ["Ask a senior", "A student's question goes to a few alumni who can help with it, not to everyone. One of them takes it and replies to the student privately. When the student has an answer, they mark the question as answered."],
  ["Stay in touch", "Home shows posts from your batch and your connections. The college posts events here. Tap “I'm going” and add them to your calendar."]
] as const;

const SAFETY = [
  "Your email and USN are never shown to other members.",
  "You choose who sees each part of your page.",
  "You can block anyone. You won't see each other anywhere, and we won't tell them.",
  "You can report anything to the college's alumni coordinators. They can remove it.",
  "Connection requests and messages are limited, so nobody can spam.",
  "You can delete your account at any time, from Settings."
];

/** For visitors: what Alumnity is, how joining works, and how it keeps people safe. */
export default function HowItWorks() {
  return (
    <PublicPage
      current="how-it-works"
      kicker="How it works"
      title="From joining"
      gold="to your first answer"
      intro="A private network for the students, alumni and faculty of HKBK College of Engineering. Here's how it works."
    >
      <ol className="steps">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="steps__step">
            <span className="steps__number" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <section aria-labelledby="safe">
        <h2 id="safe" className="info__h2">
          Keeping it safe
        </h2>
        <ul className="ticks ticks--grid">
          {SAFETY.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </PublicPage>
  );
}
