import Link from "next/link";
import { acceptAction, connectAction, declineAction, followAction, unfollowAction, withdrawAction } from "../../lib/actions/social";
import { batchLabel, firstName, timeAgo } from "../../lib/format";
import type { Role } from "../../lib/server/auth";
import type { Relation } from "../../lib/server/people";
import type { Profile } from "../../lib/server/profile";
import type { NotYetJoined } from "../../lib/server/register";
import { ActionForm } from "../app/action-form";
import { Invite } from "../app/invite";
import { Avatar } from "../social/avatar";
import { NameMark } from "../social/name-mark";

/*
 * People's cards: a big round face, the name, the batch, what they do, and the one thing
 * to do next (Connect, Requested, Accept, Message), with Follow beside it. A grid on a
 * desktop, compact rows on a phone (app/styles/people-plus.css).
 *
 * These are server components on purpose: a member's whole record (their USN included)
 * never reaches the browser. Only their id goes into the forms.
 */

type Member = { id: number; name: string; branch: string | null; joined: number | null; programme?: string | null; role: string; usn?: string | null };

/** "Engineer at Infosys · Bengaluru": what they chose to show of what they do now. */
export const headlineOf = (profile: Pick<Profile, "title" | "company" | "city">) =>
  [[profile.title, profile.company && (profile.title ? `at ${profile.company}` : profile.company)].filter(Boolean).join(" "), profile.city].filter(Boolean).join(" · ");

const Id = ({ id }: { id: number }) => <input type="hidden" name="id" value={id} />;

/** The main button for how the viewer stands to this member. */
function RelationAction({ member, relation }: { member: Member; relation: Relation }) {
  const first = firstName(member.name);
  if (relation === "connected")
    return (
      <Link className="people-btn people-btn--primary" href={`/messages/${member.id}`}>
        Message
      </Link>
    );
  if (relation === "received")
    return (
      <>
        <ActionForm action={acceptAction} showDone={false}>
          <Id id={member.id} />
          <button className="people-btn people-btn--primary" type="submit">
            Accept
          </button>
        </ActionForm>
        <ActionForm action={declineAction} showDone={false}>
          <Id id={member.id} />
          <button className="people-btn people-btn--quiet" type="submit" aria-label={`Decline ${first}'s request`}>
            Decline
          </button>
        </ActionForm>
      </>
    );
  if (relation === "sent")
    // As on Instagram: "Requested", and tapping it takes the request back (after asking).
    return (
      <ActionForm action={withdrawAction} showDone={false} confirm={`Take back your connection request to ${first}?`}>
        <Id id={member.id} />
        <button className="people-btn people-btn--pending" type="submit" title="Waiting for them to accept. Tap to take back your request.">
          Requested
        </button>
      </ActionForm>
    );
  if (relation === "none")
    return (
      <ActionForm action={connectAction} showDone={false}>
        <Id id={member.id} />
        <button className="people-btn people-btn--primary" type="submit">
          Connect
        </button>
      </ActionForm>
    );
  return null;
}

function FollowAction({ id, following }: { id: number; following: boolean }) {
  return (
    <ActionForm action={following ? unfollowAction : followAction} showDone={false}>
      <Id id={id} />
      <button className={`people-btn ${following ? "people-btn--quiet" : "people-btn--follow"}`} type="submit" aria-pressed={following}>
        {following ? "Following" : "Follow"}
      </button>
    </ActionForm>
  );
}

// "Request sent" isn't here: the card's own "Requested" button says it.
const STATE: Partial<Record<Relation, string>> = { connected: "Connected", received: "Wants to connect" };

/** A member's card. */
export function MemberCard({
  member,
  profile,
  relation,
  following,
  photoId,
  reason
}: {
  member: Member;
  profile: Profile;
  relation: Relation;
  following: boolean;
  photoId?: string | null;
  /** Why they're suggested ("From your batch"), for People you may know. */
  reason?: string;
}) {
  const headline = headlineOf(profile);
  const state = STATE[relation];
  return (
    <li className={`person-card${relation === "received" ? " person-card--asks" : ""}`}>
      <Link href={`/people/${member.id}`} className="person-card__face" tabIndex={-1} aria-hidden="true">
        <Avatar name={member.name} photoId={photoId} size={88} />
      </Link>
      <div className="person-card__who">
        <span className="person-card__name-line">
          <Link className="person-card__name" href={`/people/${member.id}`}>
            {member.name}
          </Link>
          <NameMark who={{ usn: member.usn ?? null, role: member.role as Role }} />
        </span>
        <span className="person-card__batch">{batchLabel(member)}</span>
        {headline && <span className="person-card__headline">{headline}</span>}
        <span className="person-card__tags">
          {reason && <span className="person-tag person-tag--why">{reason}</span>}
          {state && <span className={`person-tag person-tag--${relation}`}>{state}</span>}
          {profile.happyTo.mentor && reason !== "Happy to mentor" && <span className="person-tag person-tag--mentor">Mentors</span>}
        </span>
      </div>
      <div className="person-card__actions">
        <RelationAction member={member} relation={relation} />
        {(relation === "none" || relation === "sent" || relation === "received" || relation === "connected") && <FollowAction id={member.id} following={following} />}
      </div>
    </li>
  );
}

/** Someone on the college register who hasn't joined: name and batch only (never a USN), and a way to bring them in. */
export function RegisterCard({ person }: { person: NotYetJoined }) {
  return (
    <li className="person-card person-card--register">
      <span className="person-card__face" aria-hidden="true">
        <Avatar name={person.name} size={88} />
      </span>
      <div className="person-card__who">
        <span className="person-card__name-line">
          <strong className="person-card__name person-card__name--plain">{person.name}</strong>
        </span>
        <span className="person-card__batch">
          {batchLabel({ branch: person.branch, joined: person.joined, programme: person.programme })}
          {person.programme !== "B.Tech" ? ` · ${person.programme}` : ""}
        </span>
        <span className="person-card__headline person-card__headline--quiet">On HKBK&apos;s register</span>
        <span className="person-card__tags">
          <span className="person-tag person-tag--waiting">Not on Alumnity yet</span>
        </span>
      </div>
      <div className="person-card__actions">
        <Invite compact text={`${firstName(person.name)}, I found your name on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:`} />
      </div>
    </li>
  );
}

/** A request waiting for the viewer, in the strip at the top of People: accept or decline right there. */
export function RequestCard({ member, note, createdAt, photoId }: { member: Member; note: string; createdAt: number; photoId?: string | null }) {
  const first = firstName(member.name);
  return (
    <li className="request-card">
      <Link href={`/people/${member.id}`} className="request-card__face" tabIndex={-1} aria-hidden="true">
        <Avatar name={member.name} photoId={photoId} size={56} />
      </Link>
      <div className="request-card__who">
        <Link className="request-card__name" href={`/people/${member.id}`}>
          {member.name}
        </Link>
        <span className="request-card__batch">
          {batchLabel(member)}
          {batchLabel(member) ? " · " : ""}
          {timeAgo(createdAt)}
        </span>
        {note && <q className="request-card__note">{note}</q>}
      </div>
      <div className="request-card__actions">
        <ActionForm action={acceptAction} showDone={false}>
          <Id id={member.id} />
          <button className="people-btn people-btn--primary" type="submit" aria-label={`Accept ${first}'s request`}>
            Accept
          </button>
        </ActionForm>
        <ActionForm action={declineAction} showDone={false}>
          <Id id={member.id} />
          <button className="people-btn people-btn--quiet" type="submit" aria-label={`Decline ${first}'s request`}>
            Decline
          </button>
        </ActionForm>
      </div>
    </li>
  );
}
