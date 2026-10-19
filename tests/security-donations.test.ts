import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

/*
 * Security: money. The amount of a gift is decided on the server (whole rupees, between the
 * limits, in INR), the order is made by the server, and a donation counts only when Razorpay
 * vouches for it: Checkout's signature over "order|payment" or the webhook's over its body,
 * both made with secrets only the server has. Nothing a browser sends can set an amount or
 * mark a gift paid, and a replayed confirmation counts once.
 */

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "money-admin@example.com";
process.env.RAZORPAY_KEY_ID = "rzp_test_security";
process.env.RAZORPAY_KEY_SECRET = "key-secret-for-tests";
process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret-for-tests";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db").db;
let people: typeof import("../lib/server/people");
let causes: typeof import("../lib/server/causes");
let razorpay: typeof import("../lib/server/razorpay");
let webhook: typeof import("../app/api/razorpay/webhook/route").POST;

const sign = (text: string, secret: string) => createHmac("sha256", secret).update(text).digest("hex");

let n = 0;
async function member(name: string, extra: { role?: string; email?: string } = {}): Promise<U> {
  n += 1;
  const row = await db().one<{ id: number }>(
    "insert into users (email, name, branch, joined, role, created_at) values (?, ?, 'CSE', 2012, ?, ?) returning id",
    extra.email ?? `money${n}@example.com`,
    name,
    extra.role ?? "alumnus",
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

async function liveCause(): Promise<number> {
  const author = await member("Cause Author");
  const desk = await member("Desk Person", { role: "coordinator" });
  const made = await causes.proposeCause(author, { title: "Fees for first-years", story: "s".repeat(80), goal: "50000", cover: "", days: "60" });
  expect((await causes.reviewCause(desk, made.id!, true, "")).ok).toBe(true);
  return made.id!;
}

/** Razorpay's Orders API, faked: records what the server asked for. */
const asked: { amount: number; currency: string }[] = [];
const realFetch = globalThis.fetch;
let order = 0;
function fakeRazorpay() {
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { amount: number; currency: string };
    asked.push(body);
    order += 1;
    return new Response(JSON.stringify({ id: `order_sec_${order}`, amount: body.amount }), { status: 200 });
  }) as unknown as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = realFetch;
});

const call = (body: string, signature: string | null) =>
  webhook(new Request("http://localhost/api/razorpay/webhook", { method: "POST", body, headers: signature === null ? {} : { "x-razorpay-signature": signature } }));

const event = (orderId: string, payment: Record<string, unknown>, kind = "payment.captured") =>
  JSON.stringify({ event: kind, payload: { payment: { entity: { id: "pay_hook_1", order_id: orderId, currency: "INR", status: "captured", ...payment } } } });

const raised = async (id: number) => (await db().one<{ n: number }>("select coalesce(sum(amount), 0) as n from donations where cause_id = ? and status = 'paid'", id))!.n;

beforeAll(async () => {
  db = (await import("../lib/server/db")).db;
  people = await import("../lib/server/people");
  causes = await import("../lib/server/causes");
  razorpay = await import("../lib/server/razorpay");
  ({ POST: webhook } = await import("../app/api/razorpay/webhook/route"));
});

describe("the amount of a gift", () => {
  it("is whole rupees within the limits, worked out on the server; anything else is refused before an order is made", async () => {
    const id = await liveCause();
    const donor = await member("Dee Donor");
    fakeRazorpay();
    for (const amount of ["-500", "0", "9", "9.99", "-0", "NaN", "Infinity", "1e9", "500001", "1,00,00,000", "", "abc", "100 OR 1=1", "0x10"]) {
      expect((await causes.startDonation(donor, id, { amount, anonymous: false, message: "" })).ok, amount).toBe(false);
    }
    expect(asked).toEqual([]);
    // Fractions are cut to whole rupees, and the paise are the server's: ₹10.99 is ₹10.
    const ten = await causes.startDonation(donor, id, { amount: "10.99", anonymous: false, message: "" });
    expect(ten).toMatchObject({ ok: true, amount: 1000 });
    const most = await causes.startDonation(donor, id, { amount: "₹5,00,000", anonymous: false, message: "" });
    expect(most).toMatchObject({ ok: true, amount: 50_000_000 });
    // Always rupees.
    expect(asked).toEqual([
      expect.objectContaining({ amount: 1000, currency: "INR" }),
      expect.objectContaining({ amount: 50_000_000, currency: "INR" })
    ]);
    // Nothing counts yet: an order is only a promise to pay.
    expect(await raised(id)).toBe(0);
  });

  it("only goes to a live cause still open", async () => {
    const donor = await member("Dora Donor");
    const author = await member("Pending Author");
    const pending = await causes.proposeCause(author, { title: "Not approved yet", story: "p".repeat(80), goal: "5000", cover: "", days: "30" });
    fakeRazorpay();
    expect((await causes.startDonation(donor, pending.id!, { amount: "100", anonymous: false, message: "" })).ok).toBe(false);
    const live = await liveCause();
    await db().run("update causes set ends_at = ? where id = ?", Date.now() - 1, live);
    expect((await causes.startDonation(donor, live, { amount: "100", anonymous: false, message: "" })).ok).toBe(false);
    await db().run("update causes set ends_at = null, status = 'closed' where id = ?", live);
    expect((await causes.startDonation(donor, live, { amount: "100", anonymous: false, message: "" })).ok).toBe(false);
  });

  it("can't be negative, nothing, or more than was given when the desk records a payout; nor can a goal be absurd", async () => {
    const admin = await member("Money Admin", { email: "money-admin@example.com" });
    const id = await liveCause();
    await db().run("insert into donations (cause_id, donor, amount, order_id, status, paid_at, created_at) values (?, null, 100000, 'order_payout_seed', 'paid', ?, ?)", id, Date.now(), Date.now());
    for (const amount of ["-100", "0", "NaN", "Infinity", "1e12", "abc", "1001"]) expect((await causes.recordPayout(admin, id, amount, "fees")).ok, amount).toBe(false);
    const author = await member("Goal Author");
    for (const goal of ["-1000", "0", "999", "1e12", "100000001", "abc"]) {
      expect((await causes.proposeCause(author, { title: "Some cause", story: "g".repeat(80), goal, cover: "", days: "30" })).ok, goal).toBe(false);
    }
  });
});

describe("marking a gift paid", () => {
  it("needs Razorpay's signature over this very order and payment, and the donor's own order", async () => {
    const id = await liveCause();
    const donor = await member("Pat Payer");
    const other = await member("Otto Other");
    fakeRazorpay();
    const started = await causes.startDonation(donor, id, { amount: "250", anonymous: false, message: "" });
    if (!started.ok) throw new Error(started.error);
    const other2 = await causes.startDonation(other, id, { amount: "10", anonymous: false, message: "" });
    if (!other2.ok) throw new Error(other2.error);
    const genuine = sign(`${started.orderId}|pay_1`, "key-secret-for-tests");
    for (const [orderId, paymentId, signature] of [
      [started.orderId, "pay_1", ""],
      [started.orderId, "pay_1", "stand-in"], // the development stand-in's word means nothing with real keys
      [started.orderId, "pay_1", sign(`${started.orderId}|pay_1`, "a guessed secret")],
      [started.orderId, "pay_2", genuine], // another payment
      [other2.orderId, "pay_1", sign(`${other2.orderId}|pay_1`, "key-secret-for-tests")], // someone else's order
      [started.orderId, "pay_1", genuine.toUpperCase()],
      [started.orderId, "pay_1", `${genuine}00`]
    ]) {
      expect((await causes.confirmDonation(donor, orderId, paymentId, signature)).ok).toBe(false);
    }
    expect(await raised(id)).toBe(0);
    expect((await causes.confirmDonation(donor, started.orderId, "pay_1", genuine)).ok).toBe(true);
    // Sent again (a replay, a double tap): counted once.
    expect((await causes.confirmDonation(donor, started.orderId, "pay_1", genuine)).ok).toBe(true);
    expect(await raised(id)).toBe(25000);
  });

  it("the webhook: only Razorpay's signature over the exact body, the order's amount, in rupees, captured", async () => {
    const id = await liveCause();
    const donor = await member("Hook Donor");
    await db().run("insert into donations (cause_id, donor, amount, order_id, created_at) values (?, ?, 70000, 'order_hook_sec', ?)", id, donor.id, Date.now());
    const good = event("order_hook_sec", { amount: 70000 });
    expect((await call(good, null)).status).toBe(401);
    expect((await call(good, "")).status).toBe(401);
    expect((await call(good, sign(good, "a guessed secret"))).status).toBe(401);
    expect((await call(good, sign(good, "key-secret-for-tests"))).status).toBe(401); // the key secret isn't the webhook's
    // Signed, then changed (a bigger amount, another order): the signature no longer fits.
    expect((await call(good.replace("70000", "1"), sign(good, "webhook-secret-for-tests"))).status).toBe(401);
    // Genuine, but not a capture of this order's amount in rupees: acknowledged, not counted.
    for (const body of [
      event("order_hook_sec", { amount: 1 }),
      event("order_hook_sec", { amount: 7000000 }),
      event("order_hook_sec", {}),
      event("order_hook_sec", { amount: "70000" }),
      event("order_hook_sec", { amount: 70000, currency: "USD" }),
      event("order_hook_sec", { amount: 70000, status: "authorized" }),
      event("order_hook_sec", { amount: 70000, status: "failed" }),
      event("order_hook_sec", { amount: 70000 }, "payment.failed"),
      event("order_does_not_exist", { amount: 70000 })
    ]) {
      expect((await call(body, sign(body, "webhook-secret-for-tests"))).status).toBe(200);
    }
    expect(await raised(id)).toBe(0);
    // Not JSON at all, though signed: refused, nothing breaks.
    expect((await call("not json", sign("not json", "webhook-secret-for-tests"))).status).toBe(400);
    expect((await call(good, sign(good, "webhook-secret-for-tests"))).status).toBe(200);
    expect(await raised(id)).toBe(70000);
    // Replayed: still once.
    expect((await call(good, sign(good, "webhook-secret-for-tests"))).status).toBe(200);
    expect(await raised(id)).toBe(70000);
  });

  it("without a webhook secret set, no webhook call counts", () => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    try {
      expect(razorpay.webhookIsGenuine("{}", sign("{}", ""))).toBe(false);
      expect(razorpay.webhookIsGenuine("{}", sign("{}", "undefined"))).toBe(false);
    } finally {
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    }
  });

  it("the pretend payments are never on in production", () => {
    const before = { env: process.env.NODE_ENV, id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
    const env = process.env as Record<string, string | undefined>;
    try {
      env.NODE_ENV = "production";
      delete env.RAZORPAY_KEY_ID;
      delete env.RAZORPAY_KEY_SECRET;
      expect(razorpay.standIn()).toBe(false);
      expect(razorpay.donationsOpen()).toBe(false);
      expect(razorpay.paymentIsGenuine("order_standin_x", "pay", "stand-in")).toBe(false);
    } finally {
      env.NODE_ENV = before.env;
      env.RAZORPAY_KEY_ID = before.id;
      env.RAZORPAY_KEY_SECRET = before.secret;
    }
  });

  it("nothing but markPaid ever marks a donation paid", () => {
    // Every place in the server's code that writes a donation's status.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    for (const dir of ["lib", "app", "components"]) walk(join(process.cwd(), dir));
    const writers = files.filter((f) => /update donations set[^"`]*status/i.test(readFileSync(f, "utf8")));
    expect(writers.map((f) => f.replace(process.cwd(), "").replace(/\\/g, "/"))).toEqual(["/lib/server/causes.ts"]);
    const source = readFileSync(join(process.cwd(), "lib", "server", "causes.ts"), "utf8");
    expect(source.match(/update donations set/gi)).toHaveLength(1);
    expect(source).toMatch(/export async function markPaid[\s\S]*update donations set status = 'paid'/);
  });
});
