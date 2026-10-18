import Link from "next/link";
import { connectAction } from "../../lib/actions/social";
import type { User } from "../../lib/server/auth";
import { batchLabel } from "../../lib/format";
import { peopleToMeet } from "../../lib/server/people";
import { photoIdsOf } from "../../lib/server/profile";
import { connectionsOf } from "../../lib/server/social";
import { Avatar } from "../social/avatar";
import { ActionForm } from "./action-form";

/*
 * For an empty page (no messages, nothing new): people to reach instead of a dead end.
 * Your connections to write to, if you have any; otherwise people you may know, to
 * connect with.
 */
export async function PeopleToReach({ me, mode }: { me: User; mode: "write" | "connect" }) {
  const connections = mode === "write" ? (await connectionsOf(me.id)).slice(0, 4) : [];
  const people = connections.length ? connections : await peopleToMeet(me, 4);
  if (!people.length) return null;
  const photos = await photoIdsOf(people.map((p) => p.id));
  const writing = connections.length > 0;
  return (
    <section className="wf-card" aria-labelledby="to-reach">
      <h2 id="to-reach">{writing ? "Write to someone" : "People you may know"}</h2>
      <ul className="side-box__list">
        {people.map((u) => (
          <li key={u.id} className="side-person">
            <Avatar name={u.name} photoId={photos.get(u.id)} size={40} />
            <span className="side-person__who">
              <Link href={`/people/${u.id}`}>{u.name}</Link>
              <span>{batchLabel(u)}</span>
            </span>
            {writing ? (
              <Link className="pill-button" href={`/messages/${u.id}`}>
                Write
              </Link>
            ) : (
              <ActionForm action={connectAction} showDone={false}>
                <input type="hidden" name="id" value={u.id} />
                <button className="pill-button" type="submit">
                  Connect
                </button>
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
      {!writing && <p className="wf-muted">Once they accept, you can write to each other.</p>}
    </section>
  );
}

/** For a quiet notifications page: the places where things start happening. */
export function ThingsToDo({ me }: { me: User }) {
  const items =
    me.role === "student"
      ? [
          ["/ask", "Ask a senior something", "Your question goes to the few who fit it."],
          ["/batch", "Find your batch", "Connect with the people you study with."],
          ["/groups", "Join a group", "Clubs, cities, interests."]
        ]
      : [
          ["/ask", "Answer a student's question", "Say you're happy to mentor, and the ones that fit you come here."],
          ["/batch", "Find your batch", "See who's here from your year."],
          ["/events", "See what's coming up", "Reunions, talks, college days."]
        ];
  return (
    <ul className="welcome-card__steps">
      {items.map(([href, label, note]) => (
        <li key={href}>
          <a href={href}>
            <span>
              <strong>{label}</strong>
              <small>{note}</small>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
