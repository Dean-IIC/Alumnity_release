import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { createGroupAction, joinGroupAction } from "../../../lib/actions/groups";
import { GROUP_LIMITS, groupsFor, type Group } from "../../../lib/server/groups";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Groups · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND_LABEL = { open: "Open", private: "Private" } as const;

function GroupLine({ group }: { group: Group }) {
  const pending = group.my?.status === "pending";
  return (
    <li className="wf-member">
      <div className="wf-member__who">
        <Link className="wf-member__name" href={`/groups/${group.id}`}>
          {group.name}
        </Link>
        <span className="wf-muted">
          {KIND_LABEL[group.kind]} · {group.members} {group.members === 1 ? "member" : "members"}
          {group.my?.role === "owner" ? " · yours" : group.my?.role === "admin" ? " · you're an admin" : ""}
        </span>
        {group.about && <span className="wf-member__detail">{group.about.length > 140 ? `${group.about.slice(0, 140)}…` : group.about}</span>}
      </div>
      <div className="wf-actions">
        {pending ? (
          <span className="wf-tag">Asked to join</span>
        ) : group.my ? null : (
          <ActionForm action={joinGroupAction} showDone={false}>
            <input type="hidden" name="id" value={group.id} />
            <button className="button button--primary wf-small" type="submit">
              {group.kind === "open" ? "Join" : "Ask to join"}
            </button>
          </ActionForm>
        )}
      </div>
    </li>
  );
}

/** Your groups, groups to find, and starting one. */
export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireUser("/groups");
  const q = ((await searchParams).q ?? "").slice(0, 60);
  const { mine, discover } = await groupsFor(me, q);
  return (
    <AppPage user={me} current="groups" title="Groups" intro="Groups for your class, club, city or field of work.">
      <h2>Your groups</h2>
      {mine.length === 0 ? (
        <p className="wf-empty">You aren't in any groups yet. Find one below, or start one.</p>
      ) : (
        <ul className="wf-list">
          {mine.map((g) => (
            <GroupLine key={g.id} group={g} />
          ))}
        </ul>
      )}

      <h2>Find a group</h2>
      <form className="wf-filters wf-filters--one" role="search" aria-label="Find groups" action="/groups">
        <label className="field">
          <span className="field__label">Search groups</span>
          <input name="q" defaultValue={q} maxLength={60} placeholder="e.g. robotics, Dubai, 2012" />
        </label>
        <button className="button button--secondary" type="submit">
          Search
        </button>
      </form>
      {discover.length === 0 ? (
        <p className="wf-empty">{q ? "No groups match that." : "No other groups yet."}</p>
      ) : (
        <ul className="wf-list">
          {discover.map((g) => (
            <GroupLine key={g.id} group={g} />
          ))}
        </ul>
      )}

      <details className="wf-fold" id="new-group">
        <summary>Start a group</summary>
        <ActionForm action={createGroupAction} className="wf-stack">
          <label className="field">
            <span className="field__label">Name</span>
            <input name="name" required minLength={3} maxLength={GROUP_LIMITS.name} placeholder="e.g. HKBK alumni in Dubai" />
          </label>
          <label className="field">
            <span className="field__label">What the group is about</span>
            <textarea name="about" rows={3} maxLength={GROUP_LIMITS.about} />
          </label>
          <fieldset className="field">
            <legend className="field__label">Who can join</legend>
            <label className="wf-check">
              <input type="radio" name="kind" value="open" defaultChecked /> Open: any member can join and read it
            </label>
            <label className="wf-check">
              <input type="radio" name="kind" value="private" /> Private: people must ask to join. Only members can read it
            </label>
          </fieldset>
          <div>
            <button className="button button--primary" type="submit">
              Start the group
            </button>
          </div>
        </ActionForm>
      </details>
    </AppPage>
  );
}
