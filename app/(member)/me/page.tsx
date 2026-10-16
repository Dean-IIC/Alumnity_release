import type { Metadata } from "next";
import { AppPage } from "../../../components/app/app-page";
import { LogOutButton } from "../../../components/join/log-out-button";
import { ProfileSheet } from "../../../components/profile/profile-sheet";
import { profileOf } from "../../../lib/server/profile";
import { requireUser } from "../../../lib/server/session";
import { batchSizeOf } from "../../../lib/server/register";
import "../../styles/join.css";
import "../../styles/profile.css";

export const metadata: Metadata = { title: "Your page · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

/** Your page, as you see it: everything on it, who each part is shown to, and what's still empty. */
export default async function MePage() {
  const user = await requireUser("/me");
  return (
    <AppPage user={user} current="me" bare>
      <div className="profile-page">
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
      </div>
    </AppPage>
  );
}
