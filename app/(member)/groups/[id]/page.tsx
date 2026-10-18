import Link from "next/link";
import { firstName } from "../../../../lib/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../../components/app/action-form";
import { AppPage } from "../../../../components/app/app-page";
import { MemberLine } from "../../../../components/app/member-line";
import { ReportButton } from "../../../../components/app/report-button";
import { Avatar } from "../../../../components/social/avatar";
import { Composer } from "../../../../components/social/composer";
import { Post } from "../../../../components/social/post";
import { answerGroupRequestAction, groupRoleAction, joinGroupAction, leaveGroupAction, removeGroupAction, updateGroupAction } from "../../../../lib/actions/groups";
import { GROUP_LIMITS, groupFor, groupMembers } from "../../../../lib/server/groups";
import { feedFor } from "../../../../lib/server/posts";
import { photoIdsOf } from "../../../../lib/server/profile";
import { isModerator } from "../../../../lib/server/roles";
import { requireUser } from "../../../../lib/server/session";
import { PAUSED, settings } from "../../../../lib/server/settings";

export const metadata: Metadata = { title: "A group · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAGE = 15;
const ROLE = { owner: "Owner", admin: "Admin", member: "" } as const;

/** One group: what it's for, its posts (for those who may read it), its members, and (for its admins) its settings. */
export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; before?: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/groups/${raw}`);
  const id = Number(raw);
  const group = Number.isSafeInteger(id) && id > 0 ? await groupFor(me, id) : null;
  if (!group) notFound();
  const sp = await searchParams;
  const tab = sp.tab === "members" || sp.tab === "settings" ? sp.tab : "posts";
  const beforeParam = Number(sp.before);
  const before = Number.isSafeInteger(beforeParam) && beforeParam > 0 ? beforeParam : undefined;

  const member = group.my?.status === "member";
  const manager = member && (group.my?.role === "owner" || group.my?.role === "admin");
  const readable = group.kind === "open" || member;
  const [posts, people, site] = await Promise.all([
    tab === "posts" && readable ? feedFor(me, { groupId: group.id, limit: PAGE, before }) : Promise.resolve([]),
    tab === "members" && readable ? groupMembers(me, group.id) : Promise.resolve({ members: [], pending: [] }),
    settings()
  ]);
  const photos = await photoIdsOf([
    me.id,
    ...posts.flatMap((p) => [p.author.id, ...p.comments.map((c) => c.author.id)]),
    ...people.members.map((m) => m.member.id),
    ...people.pending.map((m) => m.member.id)
  ]);
  const hidden = <input type="hidden" name="id" value={group.id} />;

  return (
    <AppPage
      user={me}
      current="groups"
      back={{ href: "/groups", label: "Groups" }}
      title={group.name}
      intro={`${group.kind === "open" ? "Open group" : "Private group"} · ${group.members} ${group.members === 1 ? "member" : "members"}`}
    >
      {group.about && <p className="wf-card">{group.about}</p>}

      <div className="wf-actions">
        {!group.my ? (
          <ActionForm action={joinGroupAction} showDone={false}>
            {hidden}
            <button className="button button--primary" type="submit">
              {group.kind === "open" ? "Join the group" : "Ask to join"}
            </button>
          </ActionForm>
        ) : group.my.status === "pending" ? (
          <>
            <span className="wf-tag">You've asked to join: its admins will let you in</span>
            <ActionForm action={leaveGroupAction} showDone={false}>
              {hidden}
              <button className="button button--secondary wf-small" type="submit">
                Take back the request
              </button>
            </ActionForm>
          </>
        ) : (
          <ActionForm action={leaveGroupAction} confirm={`Leave ${group.name}?`}>
            {hidden}
            <button className="button button--secondary wf-small" type="submit">
              Leave the group
            </button>
          </ActionForm>
        )}
        {!manager && <ReportButton kind="group" id={group.id} />}
      </div>

      <nav className="wf-tabs" aria-label="This group">
        <Link href={`/groups/${group.id}`} aria-current={tab === "posts" ? "page" : undefined}>
          Posts
        </Link>
        <Link href={`/groups/${group.id}?tab=members`} aria-current={tab === "members" ? "page" : undefined}>
          Members
        </Link>
        {(manager || isModerator(me)) && (
          <Link href={`/groups/${group.id}?tab=settings`} aria-current={tab === "settings" ? "page" : undefined}>
            Settings
          </Link>
        )}
      </nav>

      {!readable ? (
        <p className="wf-empty">This group is private: only its members see its posts and who's in it. Ask to join, and one of its admins will let you in.</p>
      ) : tab === "posts" ? (
        <>
          {member &&
            (site.features.notes ? (
              <Composer firstName={firstName(me.name)} hasBatch={false} group={{ id: group.id, name: group.name }} avatar={<Avatar name={me.name} photoId={photos.get(me.id)} size={44} />} />
            ) : (
              <p className="wf-empty">{PAUSED}</p>
            ))}
          {posts.length === 0 ? (
            <p className="wf-empty">{before ? "That's everything." : member ? "Nothing here yet. Write the first post." : "Nothing here yet."}</p>
          ) : (
            posts.map((p) => <Post key={p.id} post={p} photos={photos} me={me} />)
          )}
          {posts.length === PAGE && (
            <p>
              <Link href={`/groups/${group.id}?before=${posts[posts.length - 1].createdAt}`}>Older posts →</Link>
            </p>
          )}
        </>
      ) : tab === "members" ? (
        <>
          {people.pending.length > 0 && (
            <>
              <h2>Asking to join</h2>
              <ul className="wf-list">
                {people.pending.map(({ member: u }) => (
                  <MemberLine key={u.id} member={u} photoId={photos.get(u.id)}>
                    <ActionForm action={answerGroupRequestAction} showDone={false}>
                      {hidden}
                      <input type="hidden" name="user" value={u.id} />
                      <input type="hidden" name="answer" value="accept" />
                      <button className="button button--primary wf-small" type="submit">
                        Let in
                      </button>
                    </ActionForm>
                    <ActionForm action={answerGroupRequestAction} showDone={false}>
                      {hidden}
                      <input type="hidden" name="user" value={u.id} />
                      <input type="hidden" name="answer" value="decline" />
                      <button className="button button--secondary wf-small" type="submit">
                        Turn away
                      </button>
                    </ActionForm>
                  </MemberLine>
                ))}
              </ul>
            </>
          )}
          <h2>Members</h2>
          <ul className="wf-list">
            {people.members.map(({ member: u, role }) => {
              const self = u.id === me.id;
              const owner = group.my?.role === "owner";
              const canAct = manager && !self && role !== "owner" && (role !== "admin" || owner);
              return (
                <MemberLine key={u.id} member={u} photoId={photos.get(u.id)} detail={ROLE[role] || undefined}>
                  {canAct && owner && (
                    <ActionForm action={groupRoleAction} showDone={false}>
                      {hidden}
                      <input type="hidden" name="user" value={u.id} />
                      <input type="hidden" name="action" value={role === "admin" ? "member" : "admin"} />
                      <button className="button button--secondary wf-small" type="submit">
                        {role === "admin" ? "Remove as admin" : "Make admin"}
                      </button>
                    </ActionForm>
                  )}
                  {canAct && owner && (
                    <ActionForm action={groupRoleAction} confirm={`Make ${u.name} the owner? You'll stay on as an admin.`}>
                      {hidden}
                      <input type="hidden" name="user" value={u.id} />
                      <input type="hidden" name="action" value="owner" />
                      <button className="button button--secondary wf-small" type="submit">
                        Make owner
                      </button>
                    </ActionForm>
                  )}
                  {canAct && (
                    <ActionForm action={groupRoleAction} confirm={`Remove ${u.name} from the group?`}>
                      {hidden}
                      <input type="hidden" name="user" value={u.id} />
                      <input type="hidden" name="action" value="remove" />
                      <button className="button button--secondary wf-small" type="submit">
                        Remove
                      </button>
                    </ActionForm>
                  )}
                </MemberLine>
              );
            })}
          </ul>
        </>
      ) : manager || isModerator(me) ? (
        <>
          {manager && (
            <ActionForm action={updateGroupAction} className="wf-stack">
              {hidden}
              <label className="field">
                <span className="field__label">Name</span>
                <input name="name" required minLength={3} maxLength={GROUP_LIMITS.name} defaultValue={group.name} />
              </label>
              <label className="field">
                <span className="field__label">What it's for</span>
                <textarea name="about" rows={3} maxLength={GROUP_LIMITS.about} defaultValue={group.about} />
              </label>
              <fieldset className="field">
                <legend className="field__label">Who can join</legend>
                <label className="wf-check">
                  <input type="radio" name="kind" value="open" defaultChecked={group.kind === "open"} /> Open: any member can join and read it
                </label>
                <label className="wf-check">
                  <input type="radio" name="kind" value="private" defaultChecked={group.kind === "private"} /> Private: people ask to join; only members can read it
                </label>
              </fieldset>
              <div>
                <button className="button button--primary" type="submit">
                  Save
                </button>
              </div>
            </ActionForm>
          )}
          {(group.my?.role === "owner" || isModerator(me)) && (
            <ActionForm action={removeGroupAction} confirm={`Close ${group.name} for good? Its posts go with it.`}>
              {hidden}
              <button className="button button--secondary wf-small" type="submit">
                {group.my?.role === "owner" ? "Close the group" : "Take the group down (college desk)"}
              </button>
            </ActionForm>
          )}
        </>
      ) : null}
    </AppPage>
  );
}
