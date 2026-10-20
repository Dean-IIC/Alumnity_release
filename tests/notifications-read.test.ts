import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/*
 * Notifications: opening the page clears the bell's number, but each one stays highlighted
 * (unread) until it's clicked, or "Mark all as read". A click opens only the reader's own.
 */

let db: typeof import("../lib/server/db").db;
let social: typeof import("../lib/server/social");

beforeAll(async () => {
  db = (await import("../lib/server/db")).db;
  social = await import("../lib/server/social");
  await db().run("insert into users (id, email, name, role, created_at) values (1, 'r@example.com', 'Riya Reader', 'alumnus', 0), (2, 'o@example.com', 'Omar Other', 'alumnus', 0)");
  for (const [user, text, link] of [
    [1, "Omar cheered your post", "/notes/1"],
    [1, "Omar replied to you", "/notes/2"],
    [2, "Someone else's", "/notes/3"]
  ] as const)
    await social.notify(user, { kind: "cheer", text, link });
});

const mine = () => social.notificationsFor(1);

describe("notifications, seen and read", () => {
  it("opening the page clears the bell, but each stays unread", async () => {
    expect(await social.unreadNotifications(1)).toBe(2);
    await social.markNotificationsSeen(1);
    expect(await social.unreadNotifications(1)).toBe(0);
    expect((await mine()).map((n) => n.read)).toEqual([false, false]);
    // Someone else's are untouched.
    expect(await social.unreadNotifications(2)).toBe(1);
  });

  it("a click reads that one only, and gives where it leads", async () => {
    const [first] = await mine();
    expect(await social.openNotification(1, first.id)).toBe(first.link);
    const after = await mine();
    expect(after.find((n) => n.id === first.id)!.read).toBe(true);
    expect(after.filter((n) => !n.read)).toHaveLength(1);
  });

  it("never opens someone else's, or nonsense", async () => {
    const theirs = (await social.notificationsFor(2))[0];
    expect(await social.openNotification(1, theirs.id)).toBeNull();
    expect((await social.notificationsFor(2))[0].read).toBe(false);
    expect(await social.openNotification(1, -1)).toBeNull();
    expect(await social.openNotification(1, Number.NaN)).toBeNull();
  });

  it("a new one rings the bell again; Mark all as read reads everything", async () => {
    await social.notify(1, { kind: "cheer", text: "A new one", link: "/notes/4" });
    expect(await social.unreadNotifications(1)).toBe(1);
    await social.markNotificationsRead(1);
    expect(await social.unreadNotifications(1)).toBe(0);
    expect((await mine()).every((n) => n.read)).toBe(true);
  });
});
