import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "admin@example.com";
// Real-looking Razorpay test keys, so the signatures are checked as in production.
process.env.RAZORPAY_KEY_ID = "rzp_test_example";
process.env.RAZORPAY_KEY_SECRET = "test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db").db;
let people: typeof import("../lib/server/people");
let groups: typeof import("../lib/server/groups");
let posts: typeof import("../lib/server/posts");
let social: typeof import("../lib/server/social");
let causes: typeof import("../lib/server/causes");
let razorpay: typeof import("../lib/server/razorpay");

beforeAll(async () => {
  db = (await import("../lib/server/db")).db;
  people = await import("../lib/server/people");
  groups = await import("../lib/server/groups");
  posts = await import("../lib/server/posts");
  social = await import("../lib/server/social");
  causes = await import("../lib/server/causes");
  razorpay = await import("../lib/server/razorpay");
});

let n = 0;
async function member(name: string, extra: { role?: string; email?: string } = {}): Promise<U> {
  n += 1;
  const row = await db().one<{ id: number }>(
    "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, 'CSE', 'CSE', 'B.Tech', 2012, ?, ?) returning id",
    extra.email ?? `g${n}@example.com`,
    name,
    extra.role ?? "alumnus",
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

describe("groups", () => {
  it("open groups: anyone joins and reads; posts stay in the group, off Home", async () => {
    const owner = await member("Ola Owner");
    const reader = await member("Ray Reader");
    const { id } = await groups.createGroup(owner, { name: "Robotics alumni", about: "Old club", kind: "open" });
    expect((await posts.createPost(reader, "hello", "group", [], id!)).ok).toBe(false); // not a member yet
    expect((await groups.joinGroup(reader, id!)).ok).toBe(true);
    const made = await posts.createPost(reader, "First post in the group", "everyone", [], id!);
    expect(made.ok).toBe(true);
    const stranger = await member("Sid Stranger");
    expect((await posts.feedFor(stranger, { groupId: id! })).map((p) => p.body)).toEqual(["First post in the group"]); // open: readable
    expect((await posts.feedFor(stranger)).some((p) => p.body === "First post in the group")).toBe(false); // never on Home
    expect((await posts.postFor(stranger, made.id!))?.group?.name).toBe("Robotics alumni");
  });

  it("the desk sees inside a private group only while it, or a post in it, is reported", async () => {
    const owner = await member("Gia Owner");
    const insider = await member("Ian Insider");
    const desk = await member("Dev Desk", { role: "coordinator" });
    const outsider = await member("Oli Outsider");
    const { id } = await groups.createGroup(owner, { name: "Quiet circle", about: "", kind: "private" });
    expect((await groups.joinGroup(insider, id!)).ok).toBe(true);
    expect((await groups.answerRequest(owner, id!, insider.id, true)).ok).toBe(true);
    const made = await posts.createPost(owner, "Something only for the circle", "everyone", [], id!);
    const inside = async (u: U) => (await posts.feedFor(u, { groupId: id! })).map((p) => p.body);
    // No report: the desk sees nothing inside, like anyone else outside.
    expect(await inside(desk)).toEqual([]);
    expect(await groups.reportedToDesk(desk, id!)).toBe(false);
    // A member reports a post: the desk can read the group (only the desk).
    const desk_ = await import("../lib/server/desk");
    expect((await desk_.report(insider, "post", made.id!, "This looks like a scam")).ok).toBe(true);
    expect(await inside(desk)).toEqual(["Something only for the circle"]);
    expect(await inside(outsider)).toEqual([]);
    // Reading isn't joining: the desk still can't post there.
    expect((await posts.createPost(desk, "Hello from the desk", "everyone", [], id!)).ok).toBe(false);
    // The report closed: the group is shut to the desk again.
    const open = (await desk_.reports(desk)).find((r) => r.kind === "post" && r.subjectId === made.id);
    expect(open).toBeTruthy();
    expect((await desk_.resolveReport(desk, open!.id, "dismiss")).ok).toBe(true);
    expect(await inside(desk)).toEqual([]);
  });

  it("private groups: you ask, an admin lets you in; until then you see nothing inside", async () => {
    const owner = await member("Pia Owner");
    const asker = await member("Abe Asker");
    const { id } = await groups.createGroup(owner, { name: "Hiring circle", about: "", kind: "private" });
    const secret = await posts.createPost(owner, "Openings at my company", "everyone", [], id!);
    expect((await groups.joinGroup(asker, id!)).ok).toBe(true);
    expect((await groups.groupFor(asker, id!))?.my?.status).toBe("pending");
    expect(await posts.feedFor(asker, { groupId: id! })).toEqual([]);
    expect(await posts.postFor(asker, secret.id!)).toBeNull();
    expect((await groups.groupMembers(asker, id!)).members).toEqual([]);
    expect((await social.notificationsFor(owner.id)).some((x) => x.kind === "group-request")).toBe(true);
    // Another member can't let them in; the owner can.
    const other = await member("Oz Other");
    expect((await groups.answerRequest(other, id!, asker.id, true)).ok).toBe(false);
    expect((await groups.answerRequest(owner, id!, asker.id, true)).ok).toBe(true);
    expect((await posts.postFor(asker, secret.id!))?.body).toBe("Openings at my company");
    // Mentioning someone outside a private group doesn't tell them (they couldn't see it).
    await posts.createPost(owner, `Thanks @[Oz](${other.id})`, "everyone", [], id!);
    expect((await social.notificationsFor(other.id)).some((x) => x.kind === "mention")).toBe(false);
  });

  it("only the owner makes admins; admins can't remove the owner; the owner hands on before leaving", async () => {
    const owner = await member("Una Owner");
    const a = await member("Ada Admin");
    const b = await member("Ben Member");
    const { id } = await groups.createGroup(owner, { name: "Dubai alumni", about: "", kind: "open" });
    await groups.joinGroup(a, id!);
    await groups.joinGroup(b, id!);
    expect((await groups.setGroupRole(a, id!, b.id, "admin")).ok).toBe(false);
    expect((await groups.setGroupRole(owner, id!, a.id, "admin")).ok).toBe(true);
    expect((await groups.setGroupRole(a, id!, owner.id, "remove")).ok).toBe(false);
    expect((await groups.setGroupRole(a, id!, b.id, "remove")).ok).toBe(true);
    expect((await groups.leaveGroup(owner, id!)).ok).toBe(false); // hand it on first
    expect((await groups.setGroupRole(owner, id!, a.id, "owner")).ok).toBe(true);
    expect((await groups.leaveGroup(owner, id!)).ok).toBe(true);
    expect((await groups.groupFor(a, id!))?.my?.role).toBe("owner");
  });
});

describe("causes and giving", () => {
  const story = "Two first-years from our old neighbourhood got in on merit but can't pay the semester fees. This covers both.";
  const sign = (text: string, secret: string) => createHmac("sha256", secret).update(text).digest("hex");

  async function liveCause(author: U) {
    const desk = await member("Cora Coordinator", { role: "coordinator" });
    const { id } = await causes.proposeCause(author, { title: "Fees for two first-years", story, goal: "1,50,000", cover: "", days: "60" });
    expect((await causes.reviewCause(desk, id!, true, "")).ok).toBe(true);
    return id!;
  }

  it("a cause waits for the desk; only its author and the desk see it until then; turning down needs a reason", async () => {
    const author = await member("Ann Author");
    const other = await member("Otto Other");
    const desk = await member("Dev Desk", { role: "coordinator" });
    expect((await causes.proposeCause(author, { title: "x", story, goal: "1000", cover: "", days: "30" })).ok).toBe(false);
    expect((await causes.proposeCause(author, { title: "Library books", story: "short", goal: "1000", cover: "", days: "30" })).ok).toBe(false);
    const { id } = await causes.proposeCause(author, { title: "Library books", story, goal: "25000", cover: "", days: "30" });
    expect(await causes.causeFor(other, id!)).toBeNull();
    expect((await causes.causeFor(author, id!))?.status).toBe("pending");
    expect((await causes.reviewCause(other, id!, true, "")).ok).toBe(false);
    expect((await causes.reviewCause(desk, id!, false, "")).ok).toBe(false);
    expect((await causes.reviewCause(desk, id!, false, "Please say which books, and who receives them.")).ok).toBe(true);
    expect((await social.notificationsFor(author.id)).some((x) => x.kind === "cause-rejected")).toBe(true);
    expect(await causes.causeFor(other, id!)).toBeNull();
  });

  it("a gift counts only with Razorpay's genuine signature, once, for the exact amount", async () => {
    const author = await member("Gita Author");
    const donor = await member("Dan Donor");
    const id = await liveCause(author);
    expect((await causes.startDonation(donor, id, { amount: "5", anonymous: false, message: "" })).ok).toBe(false); // under ₹10
    // The order call to Razorpay is faked: the rest is real.
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ id: "order_test_1", amount: 100000 }), { status: 200 })) as typeof fetch;
    const started = await causes.startDonation(donor, id, { amount: "1000", anonymous: false, message: "Go well" });
    globalThis.fetch = fetchBefore;
    if (!started.ok) throw new Error(started.error);
    expect(started).toMatchObject({ orderId: "order_test_1", amount: 100000, keyId: "rzp_test_example" });
    // A forged signature doesn't count; nor does someone else confirming it.
    expect((await causes.confirmDonation(donor, "order_test_1", "pay_1", "forged")).ok).toBe(false);
    const genuine = sign("order_test_1|pay_1", "test-secret");
    expect((await causes.confirmDonation(author, "order_test_1", "pay_1", genuine)).ok).toBe(false);
    expect((await causes.causeFor(donor, id))?.raised).toBe(0);
    expect((await causes.confirmDonation(donor, "order_test_1", "pay_1", genuine)).ok).toBe(true);
    expect((await causes.confirmDonation(donor, "order_test_1", "pay_1", genuine)).ok).toBe(true); // twice: counted once
    const cause = (await causes.causeFor(donor, id))!;
    expect(cause).toMatchObject({ raised: 100000, supporters: 1 });
    expect((await social.notificationsFor(author.id)).some((x) => x.kind === "cause-gift")).toBe(true);
    // Who gave is shown; how much, only to them and the desk.
    const stranger = await member("Stu Stranger");
    expect((await causes.supporters(stranger, id))[0]).toMatchObject({ name: "Dan Donor", message: "Go well", amount: null });
    expect((await causes.supporters(donor, id))[0].amount).toBe(100000);
  });

  it("the webhook: only Razorpay's signature, and only the order's amount", async () => {
    const author = await member("Hari Author");
    const donor = await member("Ivy Donor");
    const id = await liveCause(author);
    await db().run("insert into donations (cause_id, donor, amount, order_id, created_at) values (?, ?, 50000, 'order_hook', ?)", id, donor.id, Date.now());
    const body = (amount: number) => JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_hook", order_id: "order_hook", amount, status: "captured" } } } });
    expect(razorpay.webhookIsGenuine(body(50000), "nope")).toBe(false);
    expect(razorpay.webhookIsGenuine(body(50000), sign(body(50000), "webhook-secret"))).toBe(true);
    expect(await causes.markPaid("order_hook", "pay_hook", 1)).toBe(false); // wrong amount: not counted
    expect(await causes.markPaid("order_hook", "pay_hook", 50000)).toBe(true);
    expect((await causes.causeFor(donor, id))?.raised).toBe(50000);
  });

  it("payouts: administrators only, never more than was given", async () => {
    const author = await member("Jai Author");
    const admin = await member("Admin Person", { email: "admin@example.com" });
    const id = await liveCause(author);
    await db().run("insert into donations (cause_id, donor, amount, order_id, status, paid_at, created_at) values (?, ?, 200000, 'order_paid', 'paid', ?, ?)", id, author.id, Date.now(), Date.now());
    expect((await causes.recordPayout(author, id, "1000", "fees")).ok).toBe(false);
    expect((await causes.recordPayout(admin, id, "5000", "")).ok).toBe(false);
    expect((await causes.recordPayout(admin, id, "3000", "Too much")).ok).toBe(false); // only ₹2,000 given
    expect((await causes.recordPayout(admin, id, "1500", "Semester fees, paid to the college")).ok).toBe(true);
    expect((await causes.causeFor(author, id))?.paidOut).toBe(150000);
    expect(await causes.donationsCsv(author)).toBeNull();
    expect(await causes.donationsCsv(admin)).toContain("order_paid");
  });
});
