import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { SoonNotice } from "../../components/coming-soon";
import { LogOutButton } from "../../components/join/log-out-button";
import { ProfileSheet } from "../../components/profile/profile-sheet";
import { profileOf } from "../../lib/server/profile";
import { currentUser } from "../../lib/server/session";
import { batchSizeOf } from "../../lib/server/register";
import "../styles/join.css";
import "../styles/profile.css";

export const metadata: Metadata = { title: "Your page · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

/** Your page, as you see it: everything on it, who each part is shown to, and what's still empty. */
export default async function MePage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/me");
  return (
    <>
      <SiteHeader />
      <main className="profile-page container">
        <ProfileSheet person={user} profile={await profileOf(user.id)} isOwner
          batchSize={user.usn ? await batchSizeOf(user.usn) : undefined}
          actions={
            <>
              <a className="button button--primary" href="/me/edit">
                Edit your page <span aria-hidden="true">→</span>
              </a>
              <a className="button button--secondary" href="/settings">
                Settings
              </a>
            </>
          }
        />
        <LogOutButton />
      </main>
      <SiteFooter />
      <SoonNotice />
    </>
  );
}
