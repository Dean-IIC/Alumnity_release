import type { Metadata } from "next";
import { AppPage } from "../../components/app/app-page";
import { BackLink } from "../../components/back-link";
import { SettingsPanel } from "../../components/profile/settings-panel";
import { requireUser } from "../../lib/server/session";
import "../styles/join.css";
import "../styles/profile.css";

export const metadata: Metadata = { title: "Settings · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return (
    <AppPage user={user} current="me" bare>
      <div className="profile-page">
        <header className="page-head">
          <BackLink fallback="/me" label="Back" />
          <h1 className="page-title">Settings</h1>
        </header>
        <SettingsPanel email={user.email} />
      </div>
    </AppPage>
  );
}
