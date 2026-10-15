import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { MemberLine } from "../../../components/app/member-line";
import { cancelEventAction, rsvpAction } from "../../../lib/actions/content";
import { when } from "../../../lib/format";
import { attendees, eventById } from "../../../lib/server/events";
import { isModerator } from "../../../lib/server/roles";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "An event · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One event: when, where, who's coming (for its organiser), RSVP, and Add to calendar. */
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/events/${raw}`);
  const id = Number(raw);
  const event = Number.isSafeInteger(id) && id > 0 ? eventById(me, id) : null;
  if (!event) notFound();
  const over = (event.endsAt ?? event.startsAt) < Date.now();
  const full = event.capacity !== null && event.going >= event.capacity;
  const people = attendees(me, event.id);
  const manage = event.mine || isModerator(me);
  const hidden = <input type="hidden" name="id" value={event.id} />;

  return (
    <AppPage user={me} current="events" title={event.title} intro={event.organiser ? `Put up by ${event.organiser.name}` : undefined}>
      <article className="wf-card">
        {event.cancelled && <p className="wf-note wf-note--error">This event was cancelled.</p>}
        <p>
          <strong>When:</strong> {when(event.startsAt)}
          {event.endsAt ? ` – ${when(event.endsAt)}` : ""}
          <br />
          <strong>Where:</strong> {event.place}
          {event.onlineLink && (
            <>
              <br />
              <strong>Online:</strong>{" "}
              <a href={event.onlineLink} rel="noopener noreferrer nofollow" target="_blank">
                {event.onlineLink}
              </a>
            </>
          )}
          <br />
          <strong>Going:</strong> {event.going}
          {event.capacity ? ` of ${event.capacity}` : ""}
        </p>
        {event.body && <p>{event.body}</p>}
        <div className="wf-actions">
          {!event.cancelled && !over && (
            <ActionForm action={rsvpAction} showDone={false}>
              {hidden}
              <button className={`button ${event.imGoing ? "button--secondary" : "button--primary"}`} type="submit" disabled={!event.imGoing && full}>
                {event.imGoing ? "You're going ✓ (undo)" : full ? "It's full" : "I'm going"}
              </button>
            </ActionForm>
          )}
          <a className="button button--secondary" href={`/events/${event.id}/ics`} download>
            Add to calendar
          </a>
        </div>
      </article>

      {manage && (
        <section aria-labelledby="coming">
          <h2 id="coming">Who's coming · {people.length}</h2>
          {people.length === 0 ? (
            <p className="wf-empty">Nobody yet.</p>
          ) : (
            <ul className="wf-list">
              {people.map((u) => (
                <MemberLine key={u.id} member={u} />
              ))}
            </ul>
          )}
          {!event.cancelled && !over && (
            <ActionForm action={cancelEventAction} confirm="Cancel this event? Everyone coming is told.">
              {hidden}
              <button className="wf-link-button" type="submit" style={{ marginTop: "var(--space-4)" }}>
                Cancel the event
              </button>
            </ActionForm>
          )}
        </section>
      )}
      <p style={{ marginTop: "var(--space-6)" }}>
        <a className="wf-link-button" href="/events">
          ← All events
        </a>
      </p>
    </AppPage>
  );
}
