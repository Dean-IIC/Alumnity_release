import type { Metadata } from "next";
import { PeopleToReach, ThingsToDo } from "../../../components/app/people-to-reach";
import { AppPage } from "../../../components/app/app-page";
import { timeAgo } from "../../../lib/format";
import { safeNext } from "../../../lib/safe-next";
import { markNotificationsRead, notificationsFor } from "../../../lib/server/social";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Notifications · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What's happened that concerns you. Opening this page clears the count (as LinkedIn's
 * does): the new ones are marked on this visit, and read from then on. A "Mark all read"
 * button left them unread until it was pressed, and the bell kept its number.
 */
export default async function NotificationsPage() {
  const me = await requireUser("/notifications");
  const list = await notificationsFor(me.id);
  // Only links within Alumnity: a stored link can never send someone off-site.
  const safe = (link: string) => safeNext(link);
  const unread = list.filter((n) => !n.read).length;
  if (unread) await markNotificationsRead(me.id);

  return (
    <AppPage user={me} current="notifications" title="Notifications">
      {unread > 0 && <p className="notif-new-count">{unread === 1 ? "1 new since you last looked" : `${unread} new since you last looked`}</p>}
      {list.length === 0 ? (
        <>
          <p className="wf-empty">Nothing here yet. Connection requests, replies and answers will show up here. A good way to start: ask a senior a question, or connect with someone.</p>
          <ThingsToDo me={me} />
          <PeopleToReach me={me} mode="connect" />
        </>
      ) : (
        <ul className="wf-list">
          {list.map((n) => (
            <li key={n.id} className={`wf-member notif ${n.read ? "" : "notif--new"}`}>
              <a href={safe(n.link)}>
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
