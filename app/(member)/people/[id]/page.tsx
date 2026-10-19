import Link from "next/link";
import { firstName } from "../../../../lib/format";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "../../../../components/app/action-form";
import { AppPage } from "../../../../components/app/app-page";
import { Activity, Featured } from "../../../../components/profile/activity";
import { ReportButton } from "../../../../components/app/report-button";
import { ProfileSheet } from "../../../../components/profile/profile-sheet";
import { acceptAction, blockAction, connectAction, declineAction, followAction, removeConnectionAction, unblockAction, unfollowAction, withdrawAction } from "../../../../lib/actions/social";
import { followCounts, isFollowing } from "../../../../lib/server/follows";
import { recordOf } from "../../../../lib/server/asks";
import { pageFor } from "../../../../lib/server/people";
import { feedFor, postFor } from "../../../../lib/server/posts";
import { connectionCount } from "../../../../lib/server/social";
import { requireUser } from "../../../../lib/server/session";
import "../../../styles/join.css";
import "../../../styles/profile.css";
import { badgesOf } from "../../../../lib/server/badges";
import { StickyName } from "../../../../components/profile/sticky-name";
import { AlumniCardBadge } from "../../../../components/profile/alumni-card";
import "../../../styles/alumni-card.css";

export const metadata: Metadata = { title: "A member · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** A member's page as you may see it, with what you can do: connect, message, block, report. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  const me = await requireUser(`/people/${raw}`);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  if (id === me.id) redirect("/me");
  const page = await pageFor(me, id);
  // Blocked by them, paused or gone: the same "not here" either way, so a block isn't revealed.
  if (!page) notFound();
  const { owner, profile, relation } = page;
  const first = firstName(owner.name);
  const record = await recordOf(owner.id);
  const notes = relation === "blocked" ? [] : await feedFor(me, { authorId: owner.id, limit: 10 });
  // Their pinned post, if this viewer may see it (postFor applies the post's own audience).
  const featured = relation === "blocked" || !profile.featured ? null : await postFor(me, profile.featured);
  const hidden = <input type="hidden" name="id" value={owner.id} />;
  // Following is one-way, as on LinkedIn: their posts in your Following feed, no request,
  // nothing for them to accept. Connecting is two-way (and lets you message).
  const [following, counts] = await Promise.all([isFollowing(me.id, owner.id), followCounts(owner.id)]);

  const actions =
    relation === "blocked" ? (
      <ActionForm action={unblockAction}>
        {hidden}
        <button className="button button--secondary" type="submit">
          Unblock {first}
        </button>
      </ActionForm>
    ) : (
      <div className="wf-stack">
        {relation === "none" && (
          <ActionForm action={connectAction} className="wf-stack">
            {hidden}
            <label className="field">
              <span className="field__label">A note with your request (optional)</span>
              <textarea name="note" rows={2} maxLength={300} placeholder={`How you know ${first}, or why you'd like to connect`} />
            </label>
            <div>
              <button className="button button--primary" type="submit">
                Connect <span aria-hidden="true">→</span>
              </button>
            </div>
          </ActionForm>
        )}
        {relation === "sent" && (
          <div className="wf-actions">
            <span className="wf-tag">Request sent</span>
            <ActionForm action={withdrawAction}>
              {hidden}
              <button className="wf-link-button" type="submit">
                Withdraw
              </button>
            </ActionForm>
          </div>
        )}
        {relation === "received" && (
          <div className="wf-actions">
            <span>{first} would like to connect.</span>
            <ActionForm action={acceptAction}>
              {hidden}
              <button className="button button--primary wf-small" type="submit">
                Accept
              </button>
            </ActionForm>
            <ActionForm action={declineAction}>
              {hidden}
              <button className="button button--secondary wf-small" type="submit">
                Decline
              </button>
            </ActionForm>
          </div>
        )}
        {relation === "connected" && (
          <div className="wf-actions">
            <Link className="button button--primary" href={`/messages/${owner.id}`}>
              Message {first}
            </Link>
            <ActionForm action={removeConnectionAction} confirm={`Remove ${first} from your connections? They aren't told.`}>
              {hidden}
              <button className="wf-link-button" type="submit">
                Remove connection
              </button>
            </ActionForm>
          </div>
        )}
        <div className="wf-actions follow-row">
          <ActionForm action={following ? unfollowAction : followAction} showDone={false}>
            {hidden}
            <button className={`button wf-small ${following ? "button--secondary" : "button--follow"}`} type="submit">
              {following ? "Following ✓" : "+ Follow"}
            </button>
          </ActionForm>
          <span className="wf-muted">{following ? `${first}'s posts are in your Following feed.` : `See ${first}'s posts in your Following feed, without connecting.`}</span>
        </div>
        <div className="wf-actions">
          <ActionForm action={blockAction} confirm={`Block ${first}? You won't see each other anywhere on Alumnity, and any connection ends. They aren't told.`}>
            {hidden}
            <button className="wf-link-button" type="submit">
              Block
            </button>
          </ActionForm>
          <ReportButton kind="member" id={owner.id} label={`Report ${first}`} back={`/people/${owner.id}`} />
        </div>
      </div>
    );

  return (
    <AppPage user={me} current="people" back={{ href: "/people", label: "People" }} title={owner.name} intro={`${await connectionCount(owner.id)} connections · ${counts.followers} ${counts.followers === 1 ? "follower" : "followers"}${record.count ? ` · answered ${record.count} Ask${record.count === 1 ? "" : "s"}` : ""}`}>
      <StickyName name={owner.name}>
        {relation === "connected" && (
          <Link className="button button--primary wf-small" href={`/messages/${owner.id}`}>
            Message
          </Link>
        )}
      </StickyName>
      <div className="profile-page" style={{ padding: 0 }}>
        <ProfileSheet person={owner} profile={profile} isOwner={false} actions={actions} badges={await badgesOf(owner, profile)} />
        {relation !== "blocked" && <AlumniCardBadge person={owner} />}
      </div>
      {record.thanks.length > 0 && (
        <section aria-labelledby="record">
          <h2 id="record">{first}'s Record</h2>
          <p className="wf-muted">Thanks from people {first} helped through Ask a senior.</p>
          {record.thanks.map((t, i) => (
            <blockquote key={i} className="wf-card">
              <p>“{t}”</p>
            </blockquote>
          ))}
        </section>
      )}
      <div className="profile-page profile-page--more" style={{ padding: 0 }}>
        {featured && <Featured post={featured} isOwner={false} />}
        <Activity posts={notes} featuredId={featured?.id ?? null} isOwner={false} first={first} />
      </div>
    </AppPage>
  );
}
