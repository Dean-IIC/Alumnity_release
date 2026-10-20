import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { eventAction, rsvpAction } from "../../../lib/actions/content";
import { when } from "../../../lib/format";
import { canOrganise, eventsFor, type Event } from "../../../lib/server/events";
import { settings } from "../../../lib/server/settings";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Events · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

function EventLine({ event, past = false }: { event: Event; past?: boolean }) {
  const full = event.capacity !== null && event.going >= event.capacity;
  const d = new Date(event.startsAt);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-IN", { ...o, timeZone: "Asia/Kolkata" });
  return (
    <li className={`event-card ${past ? "event-card--past" : ""} ${event.cancelled ? "event-card--cancelled" : ""}`}>
      {/* A calendar leaf: the month on navy, the day large. */}
      <span className="event-card__date" aria-hidden="true">
        <small>{part({ month: "short" })}</small>
        <strong>{part({ day: "numeric" })}</strong>
        <span>
          {part({ weekday: "short" })} {part({ year: "numeric" })}
        </span>
      </span>
      <div className="event-card__body">
        <Link className="event-card__title" href={`/events/${event.id}`}>
          {event.title}
        </Link>
        <span className="event-card__when">
          {when(event.startsAt)}
          {event.place ? <> · {event.place}</> : null}
        </span>
        {event.capacity ? (
          <span className="event-card__seats">
            <span className="event-card__bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (event.going / event.capacity) * 100)}%` }} />
            </span>
            {event.going} of {event.capacity} going
          </span>
        ) : (
          <span className="event-card__seats">{event.going} going</span>
        )}
      </div>
      <div className="event-card__action">
        {event.cancelled ? (
          <span className="wf-tag wf-tag--red">Cancelled</span>
        ) : past ? null : (
          <ActionForm action={rsvpAction} showDone={false}>
            <input type="hidden" name="id" value={event.id} />
            <button className={`button wf-small ${event.imGoing ? "button--secondary" : "button--primary"}`} type="submit" disabled={!event.imGoing && full}>
              {event.imGoing ? "Going ✓ (undo)" : full ? "Full" : "I'm going"}
            </button>
          </ActionForm>
        )}
      </div>
    </li>
  );
}

/**
 * What's coming up, what's been (its own tab: a tester couldn't find past events at the
 * foot of the page), and (for organisers) a form to put one up.
 */
export default async function EventsPage({ searchParams }: { searchParams: Promise<{ new?: string; show?: string }> }) {
  const query = await searchParams;
  const opening = query.new === "1";
  const showPast = query.show === "past";
  const me = await requireUser("/events");
  const { upcoming, past } = await eventsFor(me);
  return (
    <AppPage user={me} current="events" title="Events" intro="Reunions, talks and college days.">
      <nav className="wf-tabs" aria-label="Which events">
        <Link href="/events" aria-current={showPast ? undefined : "page"}>
          Coming up{upcoming.length ? ` (${upcoming.length})` : ""}
        </Link>
        <Link href="/events?show=past" aria-current={showPast ? "page" : undefined}>
          Past events{past.length ? ` (${past.length})` : ""}
        </Link>
      </nav>

      {showPast ? (
        past.length === 0 ? (
          <p className="wf-empty">No past events yet.</p>
        ) : (
          <ul className="event-list">
            {past.map((e) => (
              <EventLine key={e.id} event={e} past />
            ))}
          </ul>
        )
      ) : upcoming.length === 0 ? (
        <p className="wf-empty">
          No events planned yet. {past.length > 0 && <Link href="/events?show=past">See past events</Link>}
        </p>
      ) : (
        <ul className="event-list">{upcoming.map((e) => <EventLine key={e.id} event={e} />)}</ul>
      )}

      {!showPast && canOrganise(me) && (await settings()).features.events && (
        <details className="wf-fold" id="new-event" open={opening}>
          <summary>Add an event</summary>
          <ActionForm action={eventAction} className="wf-stack">
            <label className="field">
              <span className="field__label">Event name</span>
              <input name="title" required maxLength={120} placeholder="e.g. CSE 2012 reunion" />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Starts (India time)</span>
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label className="field">
                <span className="field__label">Ends (optional)</span>
                <input name="endsAt" type="datetime-local" />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Where</span>
              <input name="place" required maxLength={160} placeholder="e.g. Seminar hall, or Online" />
            </label>
            <label className="field">
              <span className="field__label">Online link (optional)</span>
              <input name="onlineLink" type="url" maxLength={300} placeholder="https://" />
            </label>
            <label className="field">
              <span className="field__label">Number of seats (optional)</span>
              <input name="capacity" inputMode="numeric" pattern="[0-9]*" maxLength={6} />
            </label>
            <label className="field">
              <span className="field__label">Details</span>
              <textarea name="body" rows={4} maxLength={3000} />
            </label>
            <div>
              <button className="button button--primary" type="submit">
                Add event
              </button>
            </div>
          </ActionForm>
        </details>
      )}

    </AppPage>
  );
}
