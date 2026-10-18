import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/server/session";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { SoonNotice } from "../../components/coming-soon";
import { JoinFlow } from "../../components/join/join-flow";
import { registerFacts } from "../../lib/server/register";
import "../styles/join.css";

export const metadata: Metadata = {
  title: "Join · Alumnity",
  description: "Join Alumnity: find your name in HKBK College of Engineering's register.",
  // What an invitation shows on WhatsApp: the card is app/opengraph-image.tsx.
  openGraph: {
    siteName: "Alumnity",
    title: "Join HKBK's alumni and students on Alumnity",
    description: "Find your name in the college register and join in a minute: your batch, seniors who mentor, jobs and referrals.",
    locale: "en_IN",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Alumnity: HKBK College of Engineering's students and alumni" }]
  }
};

// Reads the register on the server at request time (it isn't part of the build).
export const dynamic = "force-dynamic";

export default async function JoinPage() {
  // Already a member: nothing to join.
  if (await currentUser()) redirect("/home");
  const known = await registerFacts();
  const facts = known ?? { count: 0, from: 1998, to: new Date().getFullYear(), branches: [] };
  return (
    <div className="force-light force-light--page">
      <SiteHeader />
      <main className="join-page container">
        <header className="page-head join-page__head">
          <p className="kicker">Join Alumnity</p>
          <h1 className="page-title">
            Find your name in the <span className="page-title__gold">register.</span>
          </h1>
          <p className="page-head__text">
            Everyone here is on the college’s own register
            {facts.count ? `: ${facts.count.toLocaleString("en-IN")} students on every course since ${facts.from}` : ""}. Find your name, and you’re in.
          </p>
        </header>
        <JoinFlow branches={facts.branches.map(({ code, name }) => ({ code, name }))} from={facts.from} to={facts.to} />
        <p className="join-page__login">
          Already joined? <Link href="/login">Log in</Link>
        </p>
      </main>
      <SiteFooter />
      <SoonNotice />
    </div>
  );
}
