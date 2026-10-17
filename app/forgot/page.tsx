import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { SoonNotice } from "../../components/coming-soon";
import { ForgotForm } from "../../components/join/forgot-form";
import "../styles/join.css";

export const metadata: Metadata = { title: "Reset your password · Alumnity" };

export default function ForgotPage() {
  return (
    <div className="force-light force-light--page">
      <SiteHeader />
      <main className="join-page container">
        <header className="page-head join-page__head">
          <p className="kicker">Forgot your password?</p>
          <h1 className="page-title">
            It happens to <span className="page-title__gold">everyone.</span>
          </h1>
          <p className="page-head__text">We’ll email you a code, and you choose a new password.</p>
        </header>
        <ForgotForm />
      </main>
      <SiteFooter />
      <SoonNotice />
    </div>
  );
}
