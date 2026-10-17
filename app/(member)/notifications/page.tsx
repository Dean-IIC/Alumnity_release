import type { Metadata } from "next";
import { PeopleToReach, ThingsToDo } from "../../../components/app/people-to-reach";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { readAllAction } from "../../../lib/actions/social";
import { timeAgo } from "../../../lib/format";
import { safeNext } from "../../../lib/safe-next";
import { notificationsFor } from "../../../lib/server/social";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Notifications · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** What's happened that concerns you. New ones are marked until you mark them read. */
export default async function NotificationsPage() {
  const me = await requireUser("/notifications");
  const list = await notificationsFor(me.id);
  // Only links within Alumnity: a stored link can never send someone off-site.
  const safe = (link: string) => safeNext(link);
  const unread = list.filter((n) => !n.read).length;

  return (
    <AppPage user={me} current="notifications" title="Notifications">
      {unread > 0 && (
        <ActionForm action={readAllAction} showDone={false}>
          <button className="button button--secondary wf-small" type="submit">
            Mark all {unread} read
          </button>
        </ActionForm>
      )}
      {list.length === 0 ? (
        <>
          <p className="wf-empty">Nothing here yet. Connection requests, replies and answers will show up here. A good way to start: ask a senior a question, or connect with someone.</p>
          <ThingsToDo me={me} />
          <PeopleToReach me={me} mode="connect" />
        </>
      ) : (
        <ul className="wf-list">
          {list.map((n) => (
            <li key={n.id} className="wf-member">
              <a href={safe(n.link)} style={{ fontWeight: n.read ? 400 : 700 }}>
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
