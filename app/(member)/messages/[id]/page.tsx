import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "../../../../components/app/app-page";
import { Messenger } from "../../../../components/messages/messenger";
import { ThreadView, type ChatMessage } from "../../../../components/messages/thread-view";
import { clockTime, dayLabel, MESSAGE_EDIT_WINDOW } from "../../../../lib/chat-format";
import { batchLabel, firstName } from "../../../../lib/format";
import { inboxFor } from "../../../../lib/server/inbox";
import { memberById, relation } from "../../../../lib/server/people";
import { photoIdsOf } from "../../../../lib/server/profile";
import { PAUSED, settings } from "../../../../lib/server/settings";
import { thread } from "../../../../lib/server/social";
import { requireUser } from "../../../../lib/server/session";

export const metadata: Metadata = { title: "Messages · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One conversation, beside the list on a laptop (full screen on a phone). Opening it marks their messages read. */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/messages/${raw}`);
  const id = Number(raw);
  const other = Number.isSafeInteger(id) && id > 0 && id !== me.id ? await memberById(id) : null;
  const rel = other ? await relation(me.id, other.id) : "none";
  if (!other || rel === "blocked" || rel === "blocked-by") notFound();
  // Read first, so the list beside it no longer counts this conversation as unread.
  const messages = await thread(me, other.id);
  const [{ conversations, contacts }, site, photos] = await Promise.all([inboxFor(me), settings(), photoIdsOf([other.id])]);
  const first = firstName(other.name);
  const now = Date.now();
  const chat: ChatMessage[] = messages.map((m) => ({
    id: m.id,
    mine: m.mine,
    body: m.body,
    at: m.createdAt,
    day: dayLabel(m.createdAt, now),
    time: clockTime(m.createdAt),
    readAt: m.readAt,
    story: m.story,
    edited: m.editedAt !== null,
    deleted: m.deletedAt !== null,
    // Yours, still there, not a quick reaction: editable for a while after sending.
    editableUntil: m.mine && m.deletedAt === null && !m.story?.reaction ? m.createdAt + MESSAGE_EDIT_WINDOW : null
  }));
  const seen = messages.reduce((n, m) => (m.mine && m.readAt ? Math.max(n, m.id) : n), 0);
  // The pulse watches this too, so an edit or a deletion shows for both without a reload.
  const changed = messages.reduce((n, m) => Math.max(n, m.editedAt ?? 0, m.deletedAt ?? 0), 0);
  const paused = !site.features.messages;
  const connected = rel === "connected";

  return (
    <AppPage user={me} current="messages" bare thread={{ with: other.id, latest: messages.at(-1)?.id ?? 0, seen, changed }}>
      <Messenger conversations={conversations} contacts={contacts} active={other.id}>
        <ThreadView
          key={other.id}
          other={{ id: other.id, name: other.name, first, photoId: photos.get(other.id) ?? null, detail: batchLabel(other) }}
          messages={chat}
          canWrite={connected && !paused}
          closed={
            paused ? (
              <p className="dm-composer__note">{PAUSED}</p>
            ) : (
              <p className="dm-composer__note">
                You can message {first} once you&rsquo;re connected. <Link href={`/people/${other.id}`}>Go to their page to connect</Link>.
              </p>
            )
          }
        />
      </Messenger>
    </AppPage>
  );
}
