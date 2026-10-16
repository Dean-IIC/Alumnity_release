import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.VAPID_PUBLIC_KEY = "test-public";
process.env.VAPID_PRIVATE_KEY = "test-private";
process.env.SMTP_HOST = "smtp.example.com";
process.env.SMTP_USER = "alumni@example.com";
process.env.SMTP_PASS = "x";
process.env.ALUMNITY_SECRET = "test-secret";

// The push services, stood in for: what was sent, and an endpoint that's gone.
const sent: { endpoint: string; payload: string }[] = [];
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => undefined,
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (sub.endpoint.includes("gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, payload });
    }
  }
}));

// The mail server, stood in for.
const mails: { to: string; subject: string; text: string }[] = [];
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: async (m: { to: string; subject: string; text: string }) => void mails.push(m) }) } }));

let db: typeof import("../lib/server/db").db;
let digest: typeof import("../lib/server/digest");
let alerts: typeof import("../lib/server/alerts");

beforeAll(async () => {
  db = (await import("../lib/server/db")).db;
  alerts = await import("../lib/server/alerts");
  digest = await import("../lib/server/digest");
  await db().run("insert into users (id, email, name, role, created_at) values (1, 'p@example.com', 'Pat Push', 'alumnus', 0)");
});

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "key", auth: "auth" } });

describe("phone notifications", () => {
  it("keeps only real https push subscriptions", async () => {
    expect(await alerts.savePushSubscription(1, sub("http://push.example.com/a"))).toBe(false);
    expect(await alerts.savePushSubscription(1, { endpoint: "https://x" })).toBe(false);
    expect(await alerts.savePushSubscription(1, sub("https://push.example.com/a"))).toBe(true);
    expect(await alerts.savePushSubscription(1, sub("https://push.example.com/gone"))).toBe(true);
    expect(await alerts.pushCount(1)).toBe(2);
  });

  it("sends only what the notification says, forgets browsers that have gone, and respects turning it off", async () => {
    await alerts.sendPush(1, { text: "New message from Asha.", link: "/messages/2" });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0].payload)).toMatchObject({ title: "Alumnity", body: "New message from Asha.", link: "/messages/2" });
    expect(await alerts.pushCount(1)).toBe(1); // the gone one was removed
    await alerts.savePrefs(1, { emailDigest: true, push: false });
    await alerts.sendPush(1, { text: "Another", link: "/" });
    expect(sent).toHaveLength(1);
  });
});

describe("the daily email", () => {
  const HOUR = 60 * 60_000;
  const note = (user: number, text: string, at: number) =>
    db().run("insert into notifications (user_id, kind, text, link, created_at) values (?, 'message', ?, '/messages', ?)", user, text, at);

  it("goes once a day, only for what they haven't seen, never after they've stopped it", async () => {
    const now = Date.now();
    await db().run("insert into users (id, email, name, role, auth_id, last_seen_at, created_at) values (2, 'd@example.com', 'Dia Digest', 'alumnus', gen_random_uuid(), ?, 0)", now - 5 * HOUR);
    await db().run("insert into users (id, email, name, role, auth_id, last_seen_at, created_at) values (3, 'e@example.com', 'Eli Seen', 'alumnus', gen_random_uuid(), ?, 0)", now);
    await note(2, "New message from Asha.", now - 2 * HOUR);
    await note(3, "New message from Ravi.", now - 2 * HOUR); // Eli has been on since
    expect(await digest.runDigest("https://alumnity.example", now)).toMatchObject({ sent: 1 });
    expect(mails.map((m) => m.to)).toEqual(["d@example.com"]);
    expect(mails[0].text).toContain("1 conversation with new messages");
    expect(mails[0].text).not.toContain("Ravi");
    // Not again the same day, even with something new.
    await note(2, "New message from Kiran.", now - HOUR);
    expect((await digest.runDigest("https://alumnity.example", now + HOUR)).sent).toBe(0);
    // The stop link works only with its own signature.
    const link = new URL(mails[0].text.match(/https:\/\/\S+unsubscribe\S+/)![0]);
    expect(digest.checkUnsubscribe(2, "forged")).toBe(false);
    expect(digest.checkUnsubscribe(3, link.searchParams.get("t")!)).toBe(false);
    expect(digest.checkUnsubscribe(2, link.searchParams.get("t")!)).toBe(true);
    await digest.stopDigest(2);
    expect((await digest.runDigest("https://alumnity.example", now + 2 * 24 * HOUR)).sent).toBe(0);
  });
});
