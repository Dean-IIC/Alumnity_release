import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { SoonNotice } from "../../components/coming-soon";
import { JoinFlow } from "../../components/join/join-flow";
import { loadRegister, registerFacts } from "../../lib/register";
import "../styles/join.css";

export const metadata: Metadata = {
  title: "Join · Alumnity",
  description: "Join Alumnity: find your name in HKBK College of Engineering's register."
};

// Reads the register on the server at request time (it isn't part of the build).
export const dynamic = "force-dynamic";

export default function JoinPage() {
  const register = loadRegister();
  const facts = register ? registerFacts(register) : { count: 0, from: 1998, to: new Date().getFullYear(), branches: [] };
  return (
    <>
      <SiteHeader />
      <main className="join-page container">
        <header className="page-head join-page__head">
          <p className="kicker">Join Alumnity</p>
          <h1 className="page-title">
            Find your name in the <span className="page-title__gold">register.</span>
          </h1>
          <p className="page-head__text">
            Everyone here is on the college’s own register
            {facts.count ? `: ${facts.count.toLocaleString("en-IN")} students on every course since ${facts.from}` : ""}. Find your line, and you’re in.
          </p>
        </header>
        <JoinFlow branches={facts.branches.map(({ code, name }) => ({ code, name }))} from={facts.from} to={facts.to} />
        <p className="join-page__login">
          Already joined? <a href="/login">Log in</a>
        </p>
      </main>
      <SiteFooter />
      <SoonNotice />
    </>
  );
}
