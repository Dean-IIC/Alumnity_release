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
  return (
    <li className="wf-member">
      <div className="wf-member__who">
        <a className="wf-member__name" href={`/events/${event.id}`}>
          {event.title}
        </a>
        <span className="wf-muted">
          {when(event.startsAt)} · {event.place}
        </span>
        <span className="wf-member__detail">
          {event.going} going{event.capacity ? ` of ${event.capacity}` : ""}
        </span>
      </div>
      <div className="wf-actions">
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

/** What's coming up, what's been, and (for organisers) a form to put one up. */
export default async function EventsPage() {
  const me = await requireUser("/events");
  const { upcoming, past } = await eventsFor(me);
  return (
    <AppPage user={me} current="events" title="Events" intro="Reunions, talks and college days.">
      <h2>Coming up</h2>
      {upcoming.length === 0 ? <p className="wf-empty">Nothing planned yet.</p> : <ul className="wf-list">{upcoming.map((e) => <EventLine key={e.id} event={e} />)}</ul>}

      {canOrganise(me) && (await settings()).features.events && (
        <section aria-labelledby="new-event">
          <h2 id="new-event">Put up an event</h2>
          <ActionForm action={eventAction} className="wf-stack">
            <label className="field">
              <span className="field__label">Name</span>
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
              <span className="field__label">How many can come (optional)</span>
              <input name="capacity" inputMode="numeric" pattern="[0-9]*" maxLength={6} />
            </label>
            <label className="field">
              <span className="field__label">What it's about</span>
              <textarea name="body" rows={4} maxLength={3000} />
            </label>
            <div>
              <button className="button button--primary" type="submit">
                Put it up
              </button>
            </div>
          </ActionForm>
        </section>
      )}

      {past.length > 0 && (
        <>
          <h2>Past events</h2>
          <ul className="wf-list">
            {past.map((e) => (
              <EventLine key={e.id} event={e} past />
            ))}
          </ul>
        </>
      )}
    </AppPage>
  );
}
