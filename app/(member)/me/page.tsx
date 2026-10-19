import Link from "next/link";
import type { Metadata } from "next";
import { AppPage } from "../../../components/app/app-page";
import { LogOutButton } from "../../../components/join/log-out-button";
import { ProfileSheet } from "../../../components/profile/profile-sheet";
import { ProfileStrength } from "../../../components/profile/profile-strength";
import { profileStrength } from "../../../lib/profile-strength";
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
import { headers } from "next/headers";
import { AlumniCardSection } from "../../../components/profile/alumni-card";
import { cardFor, originFrom } from "../../../lib/server/alumni-card";
import "../../styles/alumni-card.css";

export const metadata: Metadata = { title: "Your page · Alumnity", robots: { index: false } };

export const dynamic = "force-dynamic";

/** Your page, as you see it: everything on it, who each part is shown to, and what's still empty. */
export default async function MePage() {
  const user = await requireUser("/me");
  const profile = await profileOf(user.id);
  const [posts, featured, card] = await Promise.all([
    feedFor(user, { authorId: user.id, limit: 10 }),
    profile.featured ? postFor(user, profile.featured) : Promise.resolve(null),
    // Their alumni card: their own, built from their own record (never with the USN).
    cardFor(user, originFrom(await headers()))
  ]);
  return (
    <AppPage user={user} current="me" bare>
      <StickyName name={user.name}>
        <Link className="button button--primary wf-small" href="/me/edit">
          Edit your page
        </Link>
      </StickyName>
      <div className="profile-page">
        <ProfileSheet person={user} profile={profile} isOwner badges={await badgesOf(user, profile)}
          batchSize={user.usn ? await batchSizeOf(user.usn) : undefined}
          // Only on your own page, from the page already loaded: how full it is, and what's left.
          underTop={<ProfileStrength strength={profileStrength(user, profile)} className="strength--card" />}
          actions={
            <>
              <Link className="button button--primary" href="/me/edit">
                Edit your page <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button--secondary" href="/settings">
                Settings
              </Link>
              <a className="button button--secondary" href="#alumni-card">
                Alumnity card
              </a>
            </>
          }
        />
        <AlumniCardSection card={card} />
        {featured && <Featured post={featured} isOwner />}
        <Activity posts={posts} featuredId={featured?.id ?? null} isOwner first={firstName(user.name)} />
        <LogOutButton />
      </div>
    </AppPage>
  );
}
