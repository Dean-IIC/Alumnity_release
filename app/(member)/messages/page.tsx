import type { Metadata } from "next";
import { AppPage } from "../../../components/app/app-page";
import { PeopleToReach } from "../../../components/app/people-to-reach";
import { Messenger } from "../../../components/messages/messenger";
import { inboxFor } from "../../../lib/server/inbox";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Messages · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Your conversations, newest first. On a laptop the right-hand side waits for one to be
 * opened; on a phone the list is the whole page. Messages are only between connections.
 */
export default async function MessagesPage() {
  const me = await requireUser("/messages");
  const { conversations, contacts } = await inboxFor(me);
  return (
    <AppPage user={me} current="messages" bare>
      <Messenger conversations={conversations} contacts={contacts} empty={<PeopleToReach me={me} mode={contacts.length ? "write" : "connect"} />} />
    </AppPage>
  );
}
