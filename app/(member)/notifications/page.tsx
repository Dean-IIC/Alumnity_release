import type { Metadata } from "next";
import { PeopleToReach, ThingsToDo } from "../../../components/app/people-to-reach";
import { AppPage } from "../../../components/app/app-page";
import { PulseNow } from "../../../components/app/pulse";
import { timeAgo } from "../../../lib/format";
import { readAllAction } from "../../../lib/actions/social";
import { ActionForm } from "../../../components/app/action-form";
import { markNotificationsSeen, notificationsFor } from "../../../lib/server/social";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Notifications · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What's happened that concerns you. Opening this page clears the bell's number (as
 * LinkedIn's does), but each notification stays highlighted until it's clicked (or "Mark
 * all as read"): a tester found everything turned read the moment he looked.
 */
export default async function NotificationsPage() {
  const me = await requireUser("/notifications");
  const list = await notificationsFor(me.id);
  const unread = list.filter((n) => !n.read).length;
  // New since the last visit: what the bell was counting.
  const fresh = list.filter((n) => !n.read && !n.seen).length;
  if (fresh) await markNotificationsSeen(me.id);

  return (
    <AppPage user={me} current="notifications" title="Notifications">
      {/* The bell's count, in the bar around this page, catches up at once (the bar isn't redrawn by moving between pages). */}
      {fresh > 0 && <PulseNow />}
      {fresh > 0 && <p className="notif-new-count">{fresh === 1 ? "1 new since your last visit" : `${fresh} new since your last visit`}</p>}
      {unread > 0 && (
        <ActionForm action={readAllAction} showDone={false} className="notif-read-all">
          <button type="submit" className="button button--secondary wf-small">
            Mark all as read
          </button>
        </ActionForm>
      )}
      {list.length === 0 ? (
        <>
          <p className="wf-empty">No notifications yet. Connection requests, replies and answers will show here.</p>
          <p className="wf-muted">To start, ask a senior a question or connect with someone.</p>
          <ThingsToDo me={me} />
          <PeopleToReach me={me} mode="connect" />
        </>
      ) : (
        <ul className="wf-list">
          {list.map((n) => (
            <li key={n.id} className={`wf-member notif ${n.read ? "" : "notif--new"}`}>
              {/* Through /notifications/open: clicking it is what marks it read. A plain link, so it's never prefetched. */}
              <a href={`/notifications/open?id=${n.id}`}>
                {!n.read && <span className="sr-only">New: </span>}
                {n.text}
              </a>
              <span className="wf-muted">{timeAgo(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
