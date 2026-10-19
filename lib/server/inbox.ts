import { previewOf, shortAgo } from "../chat-format";
import { batchLabel, firstName } from "../format";
import type { User } from "./auth";
import { photoIdsOf } from "./profile";
import { connectionsOf, conversations } from "./social";

/*
 * What the Messages pages show beside a conversation: the list of conversations (face,
 * last message, how long ago, unread) and the connections a new message can go to. Both
 * the list page and an open conversation draw the same list (the two panes on a laptop).
 */

export type InboxItem = { id: number; name: string; photoId: string | null; preview: string; ago: string; unread: number };
export type Contact = { id: number; name: string; first: string; photoId: string | null; detail: string };

/** The newest connections first; plenty for the "New message" picker without a heavy page. */
const CONTACTS = 500;

export async function inboxFor(me: User): Promise<{ conversations: InboxItem[]; contacts: Contact[] }> {
  const [list, connections] = await Promise.all([conversations(me), connectionsOf(me.id)]);
  const people = connections.slice(0, CONTACTS);
  const photos = await photoIdsOf([...list.map((c) => c.with.id), ...people.map((u) => u.id)]);
  const now = Date.now();
  return {
    conversations: list.map((c) => ({
      id: c.with.id,
      name: c.with.name,
      photoId: photos.get(c.with.id) ?? null,
      preview: previewOf(c),
      ago: shortAgo(c.lastAt, now),
      unread: c.unread
    })),
    contacts: people.map((u) => ({ id: u.id, name: u.name, first: firstName(u.name), photoId: photos.get(u.id) ?? null, detail: batchLabel(u) }))
  };
}
