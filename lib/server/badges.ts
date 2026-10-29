import { DEVELOPERS } from "../about-content";
import type { User } from "./auth";
import { db } from "./db";
import type { Profile } from "./profile";

/*
 * What someone has earned on Alumnity, shown on their page: helping juniors (questions
 * they answered), hosting events, mentoring, and (for the students who built it) building
 * it. Counts only, worked out in one query; nothing here is shown that their page doesn't already.
 */

export type Badge = { key: string; label: string; detail: string; tone: "blue" | "red" | "green" | "gold" };

/** The developers: the students who built Alumnity (the Developers page), by USN. */
const FOUNDERS = new Set<string>(DEVELOPERS.team.map((d) => d.usn.toUpperCase()));

export async function badgesOf(person: User, profile: Profile): Promise<Badge[]> {
  const row = await db().one<{ helped: number; hosted: number }>(
    `select (select count(*) from asks where taker = ? and status = 'answered') as helped,
            (select count(*) from events where organiser = ? and cancelled_at is null) as hosted`,
    person.id,
    person.id
  );
  const helped = Number(row?.helped ?? 0);
  const badges: Badge[] = [];
  // First: it's the rarest. Only the students who built Alumnity.
  if (person.usn && FOUNDERS.has(person.usn.toUpperCase())) badges.push({ key: "founding", label: "Developer", detail: "One of the students who built Alumnity", tone: "gold" });
  if (profile.happyTo.mentor) badges.push({ key: "mentor", label: "Mentor", detail: "Happy to mentor juniors", tone: "green" });
  if (helped >= 1) {
    const tier = helped >= 10 ? 10 : helped >= 5 ? 5 : 1;
    badges.push({ key: "helped", label: tier === 1 ? "Helped a junior" : `Helped ${tier} juniors`, detail: `Answered ${helped} ${helped === 1 ? "question" : "questions"} from students`, tone: "red" });
  }
  if (Number(row?.hosted ?? 0) >= 1) badges.push({ key: "host", label: "Event host", detail: "Has organised an event for HKBK", tone: "blue" });
  return badges;
}
