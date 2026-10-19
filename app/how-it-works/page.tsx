import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";

export const metadata: Metadata = {
  title: "How it works · Alumnity",
  description: "Who can join Alumnity, what you can do there, and how we keep your details private."
};

const STEPS = [
  ["Find your name in the register", ["Search with your name and USN, or your name, branch and joining year.", "Not in the register? Then you can't join."]],
  ["Check your email, choose a password", ["We email you a six-digit code.", "Your email is never shown to other members."]],
  ["Set up your page", ["Say what you do, what you know and how you can help.", "Pick who sees each part: everyone, your batch, your connections or only you."]],
  ["Connect", ["Start with your batch. Send a connection request, with a short note if you like.", "Once they say yes, you can message each other."]],
  ["Ask a senior", ["A student's question goes to a few alumni who can help, not to everyone.", "One of them answers the student in private.", "Once the student has an answer, they mark the question as answered."]],
  ["Stay in touch", ["Home shows posts from your batch, your connections and the college.", "On an event, tap “I'm going” and add it to your calendar."]]
] as const;

const SAFETY = [
  "Your email and USN are never shown to other members.",
  "You choose who sees each part of your page.",
  "You can block anyone. You won't see each other anywhere, and we won't tell them.",
  "You can report anything to the college desk. They can take it down.",
  "There's a limit on connection requests and messages, so nobody can spam.",
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
      intro="Only for students, alumni and teachers of HKBK College of Engineering. Here's how it works."
    >
      <ol className="steps">
        {STEPS.map(([title, lines], i) => (
          <li key={title} className="steps__step">
            <span className="steps__number" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2>{title}</h2>
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
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
