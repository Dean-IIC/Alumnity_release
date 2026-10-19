import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffJoinForm } from "../../../components/join/staff-join-form";
import { SiteFooter } from "../../../components/site-footer";
import { SiteHeader } from "../../../components/site-header";
import { currentUser } from "../../../lib/server/session";
import "../../styles/join.css";

export const metadata: Metadata = { title: "Join as staff · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** For teachers, coordinators and administrators the college desk has invited. */
export default async function StaffJoinPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (await currentUser()) redirect("/home");
  const email = (await searchParams).email?.slice(0, 254) ?? "";
  return (
    <div className="force-light force-light--page">
      <SiteHeader />
      <main className="join-page container">
        <header className="page-head join-page__head">
          <p className="kicker">Join as staff</p>
          <h1 className="page-title">
            Welcome to <span className="page-title__gold">Alumnity.</span>
          </h1>
          <p className="page-head__text">The college desk has invited you. Get a code by email, then choose a password.</p>
        </header>
        <StaffJoinForm invitedEmail={email} />
      </main>
      <SiteFooter />
    </div>
  );
}
