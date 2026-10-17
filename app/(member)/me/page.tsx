import type { Metadata } from "next";
import { AppPage } from "../../../components/app/app-page";
import { LogOutButton } from "../../../components/join/log-out-button";
import { ProfileSheet } from "../../../components/profile/profile-sheet";
import { profileOf } from "../../../lib/server/profile";
import { requireUser } from "../../../lib/server/session";
import { batchSizeOf } from "../../../lib/server/register";
import "../../styles/join.css";
import "../../styles/profile.css";
import { badgesOf } from "../../../lib/server/badges";
import { Activity, Featured } from "../../../components/profile/activity";
import { feedFor, postFor } from "../../../lib/server/posts";
import { firstName } from "../../../lib/format";
import { StickyName } from "../../../components/profile/sticky-name";

export const metadata: Metadata = { title: "Your page · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

/** Your page, as you see it: everything on it, who each part is shown to, and what's still empty. */
export default async function MePage() {
  const user = await requireUser("/me");
  const profile = await profileOf(user.id);
  const [posts, featured] = await Promise.all([feedFor(user, { authorId: user.id, limit: 10 }), profile.featured ? postFor(user, profile.featured) : Promise.resolve(null)]);
  return (
    <AppPage user={user} current="me" bare>
      <StickyName name={user.name}>
        <a className="button button--primary wf-small" href="/me/edit">
          Edit your page
        </a>
      </StickyName>
      <div className="profile-page">
        <ProfileSheet person={user} profile={profile} isOwner badges={await badgesOf(user, profile)}
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
        {featured && <Featured post={featured} isOwner />}
        <Activity posts={posts} featuredId={featured?.id ?? null} isOwner first={firstName(user.name)} />
        <LogOutButton />
      </div>
    </AppPage>
  );
}
