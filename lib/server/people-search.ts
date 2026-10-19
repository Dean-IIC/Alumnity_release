import { toUser, type User } from "./auth";
import { db } from "./db";
import { followingIds } from "./follows";
import { relationsOf, searchMembers, type Found, type SearchQuery } from "./people";
import { profileFor, profileFromData } from "./profile";
import { searchRegister, type NotYetJoined } from "./register";
import { requestsFor, type Pending } from "./social";

/*
 * What the People page shows, decided here rather than in the page so it can be tested:
 * the requests waiting for you (first, as on Instagram), one list of everyone a search
 * finds (members and people on the college register who haven't joined, together), and
 * people you may know when nothing is typed.
 */

/** A person in People's results: a member (with how you stand and whether you follow them), or someone on the register who hasn't joined yet. */
export type PersonCard = ({ kind: "member"; following: boolean } & Found) | { kind: "register"; person: NotYetJoined };

export type PeopleResults = {
  cards: PersonCard[];
  /** Everyone shown: members and register people together (testers saw "0 found" above a list of names). */
  count: number;
  /** There were more than we show (members or register cut off at their limit). */
  more: boolean;
  /** The register search was skipped: the viewer has searched it enough this hour. */
  registerLimited: boolean;
};

export const MEMBER_RESULTS = 60;
export const REGISTER_RESULTS = 20;

/**
 * Everyone a search finds, in one list: members first (they can be reached now), then
 * people on the register who match a typed name or USN, each to be marked "Not on
 * Alumnity yet". The register is only searched when something is typed (it isn't a list to
 * browse from here, and each search counts against the hourly limit); never a USN back.
 */
export async function findPeople(viewer: User, query: SearchQuery): Promise<PeopleResults> {
  const [members, register, follows] = await Promise.all([
    searchMembers(viewer, query, MEMBER_RESULTS),
    query.q ? searchRegister(viewer, { q: query.q, branch: query.branch, year: query.year }, REGISTER_RESULTS) : Promise.resolve({ people: [], limited: false }),
    followingIds(viewer.id)
  ]);
  // "Happy to mentor" is something only members say: the register has nobody to match it.
  const registerPeople = query.help ? [] : register.people;
  const cards: PersonCard[] = [
    ...members.map((f): PersonCard => ({ kind: "member", ...f, following: follows.has(f.member.id) })),
    ...registerPeople.map((person): PersonCard => ({ kind: "register", person }))
  ];
  return {
    cards,
    count: cards.length,
    more: members.length >= MEMBER_RESULTS || registerPeople.length >= REGISTER_RESULTS,
    registerLimited: register.limited
  };
}

/** Requests waiting for the viewer, newest first: the strip at the top of People. */
export async function waitingForYou(viewer: User, limit = 12): Promise<{ requests: Pending[]; total: number }> {
  const { received } = await requestsFor(viewer);
  return { requests: received.slice(0, limit), total: received.length };
}

export type Suggestion = { kind: "member"; following: boolean; reason: string } & Found;

/**
 * People you may know, for People when nothing is typed: your batch first, then those
 * happy to mentor from your branch, your branch, other mentors, then the newest members.
 * Nobody you're connected to or have asked (or who asked you: they're in the requests
 * strip), nobody blocked either way, no paused members, no college accounts.
 */
export async function suggestPeople(viewer: User, limit = 12): Promise<Suggestion[]> {
  const [rows, relationTo, follows] = await Promise.all([
    db().all(
      `select users.*, profiles.data as profile_data from users left join profiles on profiles.user_id = users.id
       where users.id != ? and users.suspended_at is null and users.college_account = 0
       and users.id not in (select blocked from blocks where blocker = ?) and users.id not in (select blocker from blocks where blocked = ?)
       and users.id not in (select addressee from connections where requester = ?) and users.id not in (select requester from connections where addressee = ?)
       order by (users.branch is not distinct from ? and users.joined is not distinct from ?) desc, (users.branch is not distinct from ?) desc, users.created_at desc
       limit 200`,
      viewer.id,
      viewer.id,
      viewer.id,
      viewer.id,
      viewer.id,
      viewer.branch,
      viewer.joined,
      viewer.branch
    ),
    relationsOf(viewer.id),
    followingIds(viewer.id)
  ]);
  const scored = rows.map((row, order) => {
    const member = toUser(row);
    const rel = relationTo(member.id);
    const profile = profileFor(viewer, member, profileFromData((row.profile_data as string) ?? null), rel === "connected");
    const sameBranch = Boolean(viewer.branch) && member.branch === viewer.branch;
    const sameBatch = sameBranch && Boolean(viewer.joined) && member.joined === viewer.joined;
    const mentor = profile.happyTo.mentor;
    // Batch (4) outranks everything; a mentor from your branch (2 + 1.5) comes before the
    // rest of your branch (2); a mentor elsewhere (1.5) before the newest members (0).
    const score = (sameBatch ? 4 : sameBranch ? 2 : 0) + (mentor ? 1.5 : 0);
    const reason = sameBatch ? "From your batch" : mentor ? "Happy to mentor" : sameBranch ? "From your branch" : "New on Alumnity";
    return { suggestion: { kind: "member" as const, member, profile, relation: rel, following: follows.has(member.id), reason }, score, order };
  });
  return scored
    .filter((s) => s.suggestion.relation === "none")
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.suggestion);
}
