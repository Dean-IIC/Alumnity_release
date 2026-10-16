import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { SoonNotice } from "../../components/coming-soon";
import { LoginForm } from "../../components/join/login-form";
import { safeNext } from "../../lib/safe-next";
import { currentUser } from "../../lib/server/session";
import "../styles/join.css";

export const metadata: Metadata = {
  title: "Log in · Alumnity",
  description: "Log in to Alumnity, HKBK College of Engineering's alumni network."
};

export const dynamic = "force-dynamic";

/** Already signed in: straight on to where you were going (or Home). */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect(safeNext((await searchParams).next));
  return (
    <>
      <SiteHeader />
      <main className="join-page container">
        <header className="page-head join-page__head">
          <p className="kicker">Log in</p>
          <h1 className="page-title">
            Welcome <span className="page-title__gold">back.</span>
          </h1>
          <p className="page-head__text">Your page in the register is waiting.</p>
        </header>
        <LoginForm />
      </main>
      <SiteFooter />
      <SoonNotice />
    </>
  );
}
