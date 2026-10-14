import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { SettingsPanel } from "../../components/profile/settings-panel";
import { currentUser } from "../../lib/server/session";
import "../styles/join.css";
import "../styles/profile.css";

export const metadata: Metadata = { title: "Settings · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/settings");
  return (
    <>
      <SiteHeader />
      <main className="profile-page container">
        <header className="page-head">
          <a className="back-link" href="/me">
            <span aria-hidden="true">←</span> Your page
          </a>
          <h1 className="page-title">Settings</h1>
        </header>
        <SettingsPanel email={user.email} />
      </main>
      <SiteFooter />
    </>
  );
}
