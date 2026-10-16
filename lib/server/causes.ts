import { db } from "./db";
import { rupees } from "../format";
import type { User } from "./auth";
import { mediaById } from "./media";
import { blockIds, membersByIds } from "./people";
import { createOrder, donationsOpen, paymentIsGenuine } from "./razorpay";
import { isAdmin, isModerator } from "./roles";
import { notify, type Result } from "./social";
import { withinLimit } from "./throttle";

/*
 * Causes: a scholarship fund, a classmate's medical bills, the library's new wing. Any
 * member may propose one; it's shown once the college desk approves it. Members give
 * through Razorpay (lib/server/razorpay.ts); every rupee goes to the college's account, and
 * the desk records what it pays out to each cause, so everyone can see the money arrive.
 *
 * Amounts are kept in paise (₹1 = 100 paise), shown in rupees. Who gave is shown (unless
 * they chose not to be named); how much each person gave is shown only to them and the desk.
 */

export const CAUSE_LIMITS = { title: 100, story: 5000, message: 200, minGoal: 1_000, maxGoal: 10_00_00_000, minGift: 10, maxGift: 5_00_000 } as const;
const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });

export type CauseStatus = "pending" | "live" | "rejected" | "closed";

export type Cause = {
  id: number;
  title: string;
  story: string;
  /** In paise. */
  goal: number;
  raised: number;
  paidOut: number;
  supporters: number;
  cover: string | null;
  status: CauseStatus;
  reviewNote: string | null;
  author: User | null;
  endsAt: number | null;
  createdAt: number;
  mine: boolean;
};

export { rupees };

export type Supporter = { name: string | null; memberId: number | null; message: string; at: number; amount: number | null };

type CauseRow = {
  id: number;
  author: number | null;
  title: string;
  story: string;
  goal: number;
  cover: string | null;
  status: CauseStatus;
  review_note: string | null;
  ends_at: number | null;
  created_at: number;
};


async function toCauses(rows: CauseRow[], viewer: User): Promise<Cause[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const q = ids.map(() => "?").join(",");
  const [raised, paid, authors] = await Promise.all([
    db().all<{ cause_id: number; total: number; n: number }>(
      `select cause_id, coalesce(sum(amount), 0) as total, count(distinct coalesce(donor::text, order_id)) as n from donations where status = 'paid' and cause_id in (${q}) group by cause_id`,
      ...ids
    ),
    db().all<{ cause_id: number; total: number }>(`select cause_id, coalesce(sum(amount), 0) as total from cause_payouts where cause_id in (${q}) group by cause_id`, ...ids),
    membersByIds(rows.flatMap((r) => (r.author === null ? [] : [r.author])))
  ]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    story: r.story,
    goal: r.goal,
    raised: raised.find((x) => x.cause_id === r.id)?.total ?? 0,
    paidOut: paid.find((x) => x.cause_id === r.id)?.total ?? 0,
    supporters: raised.find((x) => x.cause_id === r.id)?.n ?? 0,
    cover: r.cover,
    status: r.status,
    reviewNote: r.author === viewer.id || isModerator(viewer) ? r.review_note : null,
    author: r.author === null ? null : (authors.get(r.author) ?? null),
    endsAt: r.ends_at,
    createdAt: r.created_at,
    mine: r.author === viewer.id
  }));
}

const causeRow = (id: number) => (Number.isSafeInteger(id) ? db().one<CauseRow>("select * from causes where id = ?", id) : Promise.resolve(undefined));

/** Whether `viewer` may see a cause: live and closed ones, everyone; others, its author and the desk. */
const mayView = (viewer: User, r: CauseRow) => r.status === "live" || r.status === "closed" || r.author === viewer.id || isModerator(viewer);

export async function causeFor(viewer: User, id: number): Promise<Cause | null> {
  const row = await causeRow(id);
  return row && mayView(viewer, row) ? (await toCauses([row], viewer))[0] : null;
}

/** A few live causes, for Home: those still furthest from their goal first. */
export async function liveCauses(viewer: User, limit = 2): Promise<Cause[]> {
  const rows = await db().all<CauseRow>("select * from causes where status = 'live' and (ends_at is null or ends_at > ?) order by reviewed_at desc limit 20", Date.now());
  return (await toCauses(rows, viewer)).sort((a, b) => a.raised / a.goal - b.raised / b.goal).slice(0, limit);
}

/** Live causes (newest first), your own (any state), past ones, and, for the desk, those waiting to be reviewed. */
export async function causesFor(viewer: User): Promise<{ live: Cause[]; mine: Cause[]; past: Cause[]; waiting: Cause[] }> {
  const [live, mine, past, waiting] = await Promise.all([
    db().all<CauseRow>("select * from causes where status = 'live' order by reviewed_at desc, id desc limit 100"),
    db().all<CauseRow>("select * from causes where author = ? order by created_at desc limit 50", viewer.id),
    db().all<CauseRow>("select * from causes where status = 'closed' order by closed_at desc limit 20"),
    isModerator(viewer) ? db().all<CauseRow>("select * from causes where status = 'pending' order by created_at limit 100") : Promise.resolve([])
  ]);
  const [a, b, c, d] = await Promise.all([toCauses(live, viewer), toCauses(mine, viewer), toCauses(past, viewer), toCauses(waiting, viewer)]);
  return { live: a, mine: b, past: c, waiting: d };
}

/** Anyone proposes a cause; it waits for the college desk. */
export async function proposeCause(me: User, input: { title: string; story: string; goal: string; cover: string; days: string }): Promise<Result & { id?: number }> {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, CAUSE_LIMITS.title);
  const story = input.story.trim().slice(0, CAUSE_LIMITS.story);
  const goalRupees = Math.floor(Number(input.goal.replace(/[,₹\s]/g, "")));
  if (title.length < 5) return no("Give the cause a name that says what it is.");
  if (story.length < 50) return no("Tell people about it: who it helps, what the money is for, and who you are to it (at least a few lines).");
  if (!(goalRupees >= CAUSE_LIMITS.minGoal && goalRupees <= CAUSE_LIMITS.maxGoal)) return no(`Set a goal between ${rupees(CAUSE_LIMITS.minGoal * 100)} and ${rupees(CAUSE_LIMITS.maxGoal * 100)}.`);
  let cover: string | null = null;
  if (input.cover) {
    const media = await mediaById(input.cover);
    if (!media || media.userId !== me.id || media.kind !== "image") return no("That photo isn't yours, or has gone. Add it again.");
    cover = media.id;
  }
  const days = Math.floor(Number(input.days));
  const endsAt = days >= 7 && days <= 365 ? Date.now() + days * DAY : null;
  if (!(await withinLimit(`cause:${me.id}`, 2, DAY))) return no("That's two causes today: the most in a day.");
  const row = await db().one<{ id: number }>(
    "insert into causes (author, title, story, goal, cover, ends_at, created_at) values (?, ?, ?, ?, ?, ?, ?) returning id",
    me.id,
    title,
    story,
    goalRupees * 100,
    cover,
    endsAt,
    Date.now()
  );
  return { ok: true, id: row!.id };
}

/** The college desk approves a cause (it goes live) or turns it down, with a note for its author. */
export async function reviewCause(me: User, id: number, approve: boolean, note: string): Promise<Result> {
  if (!isModerator(me)) return no("Only the college desk can do that.");
  const row = await causeRow(id);
  if (!row || row.status !== "pending") return no("That cause isn't waiting for review.");
  const why = note.trim().slice(0, 500);
  if (!approve && !why) return no("Say why, so its author knows what to change.");
  await db().run("update causes set status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? where id = ?", approve ? "live" : "rejected", why || null, me.id, Date.now(), id);
  const { audit } = await import("./desk");
  await audit(me, approve ? "approved cause" : "turned down cause", `cause ${id}`, why ? `${row.title}: ${why}` : row.title);
  if (row.author !== null) {
    await notify(row.author, {
      actor: me.id,
      kind: approve ? "cause-live" : "cause-rejected",
      text: approve ? `Your cause “${row.title}” is live. Share it!` : `Your cause “${row.title}” wasn't approved: ${why}`,
      link: `/causes/${id}`
    });
  }
  return { ok: true };
}

/** Its author or the desk closes a cause: no more donations; what was given stays on record. */
export async function closeCause(me: User, id: number, note = ""): Promise<Result> {
  const row = await causeRow(id);
  if (!row || (row.status !== "live" && row.status !== "pending")) return no("That cause isn't open.");
  if (row.author !== me.id && !isModerator(me)) return no("Only its author or the college desk can close it.");
  await db().run("update causes set status = 'closed', closed_at = ?, review_note = coalesce(?, review_note) where id = ?", Date.now(), note.trim().slice(0, 500) || null, id);
  if (row.author !== me.id) {
    const { audit } = await import("./desk");
    await audit(me, "closed cause", `cause ${id}`, row.title);
  }
  return { ok: true };
}

/** Who gave, newest first: names unless they chose not to be named; amounts only for the desk (and the giver's own). */
export async function supporters(viewer: User, id: number): Promise<Supporter[]> {
  const row = await causeRow(id);
  if (!row || !mayView(viewer, row)) return [];
  const [rows, blocked] = await Promise.all([
    db().all<{ donor: number | null; anonymous: number; message: string; paid_at: number; amount: number }>(
      "select donor, anonymous, message, paid_at, amount from donations where cause_id = ? and status = 'paid' order by paid_at desc limit 200",
      id
    ),
    blockIds(viewer.id)
  ]);
  const people = await membersByIds(rows.flatMap((r) => (r.donor !== null && !r.anonymous ? [r.donor] : [])));
  return rows.map((r) => {
    const named = r.donor !== null && !r.anonymous && !blocked.has(r.donor) ? people.get(r.donor) : undefined;
    return {
      name: named?.name ?? null,
      memberId: named?.id ?? null,
      message: r.donor !== null && blocked.has(r.donor) ? "" : r.message,
      at: r.paid_at,
      amount: isModerator(viewer) || r.donor === viewer.id ? r.amount : null
    };
  });
}

// ---------- Giving ----------

export type Checkout = { ok: true; orderId: string; amount: number; keyId: string; standIn: boolean; title: string } | { ok: false; error: string };

/** Starts a gift: an order with Razorpay, and a donation waiting for its payment. */
export async function startDonation(me: User, id: number, input: { amount: string; anonymous: boolean; message: string }): Promise<Checkout> {
  if (!donationsOpen()) return { ok: false, error: "Giving isn't open yet: the college is setting up payments." };
  const row = await causeRow(id);
  if (!row || row.status !== "live" || (row.ends_at !== null && row.ends_at < Date.now())) return { ok: false, error: "This cause isn't taking donations." };
  const amountRupees = Math.floor(Number(input.amount.replace(/[,₹\s]/g, "")));
  if (!(amountRupees >= CAUSE_LIMITS.minGift && amountRupees <= CAUSE_LIMITS.maxGift)) {
    return { ok: false, error: `Give between ${rupees(CAUSE_LIMITS.minGift * 100)} and ${rupees(CAUSE_LIMITS.maxGift * 100)} at a time.` };
  }
  if (!(await withinLimit(`donate:${me.id}`, 20, 60 * 60_000))) return { ok: false, error: "That's a lot of tries in an hour. Try again a little later." };
  const amount = amountRupees * 100;
  let order;
  try {
    order = await createOrder(amount, `cause-${id}-${me.id}`, { cause_id: String(id), member_id: String(me.id) });
  } catch {
    return { ok: false, error: "Razorpay didn't answer just now. Please try again in a minute." };
  }
  await db().run(
    "insert into donations (cause_id, donor, amount, order_id, anonymous, message, created_at) values (?, ?, ?, ?, ?, ?, ?)",
    id,
    me.id,
    amount,
    order.id,
    input.anonymous ? 1 : 0,
    input.message.trim().slice(0, CAUSE_LIMITS.message),
    Date.now()
  );
  return { ok: true, orderId: order.id, amount, keyId: order.keyId, standIn: order.stand_in, title: row.title };
}

/** A payment Razorpay vouches for (Checkout's signature, or the webhook): the donation counts. Safe to call twice. */
export async function markPaid(orderId: string, paymentId: string, amount?: number): Promise<boolean> {
  const donation = await db().one<{ id: number; cause_id: number; donor: number | null; amount: number; anonymous: number; status: string }>(
    "select id, cause_id, donor, amount, anonymous, status from donations where order_id = ?",
    orderId
  );
  if (!donation) return false;
  if (amount !== undefined && amount !== donation.amount) return false;
  if (donation.status === "paid") return true;
  const changed = await db().run("update donations set status = 'paid', payment_id = ?, paid_at = ? where id = ? and status != 'paid'", paymentId, Date.now(), donation.id);
  if (!changed) return true;
  const cause = await causeRow(donation.cause_id);
  if (cause?.author !== null && cause?.author !== undefined && cause.author !== donation.donor) {
    const giver = donation.donor !== null && !donation.anonymous ? (await membersByIds([donation.donor])).get(donation.donor) : undefined;
    await notify(cause.author, {
      actor: giver?.id,
      kind: "cause-gift",
      text: `${giver ? giver.name : "Someone"} gave ${rupees(donation.amount)} to “${cause.title}”.`,
      link: `/causes/${cause.id}`
    });
  }
  return true;
}

/** The donor's browser reports the payment; only a genuine signature counts. */
export async function confirmDonation(me: User, orderId: string, paymentId: string, signature: string): Promise<Result> {
  const mine = await db().one("select 1 from donations where order_id = ? and donor = ?", orderId, me.id);
  if (!mine || !paymentIsGenuine(orderId, paymentId, signature)) return no("We couldn't confirm that payment. If money left your account, it will show here within a few minutes; otherwise write to the alumni office.");
  await markPaid(orderId, paymentId);
  return { ok: true };
}

/** The desk records money paid out to a cause (administrators: it's the college's money). */
export async function recordPayout(me: User, id: number, amountInput: string, note: string): Promise<Result> {
  if (!isAdmin(me)) return no("Only an administrator can record payouts.");
  const row = await causeRow(id);
  if (!row || row.status === "pending" || row.status === "rejected") return no("That cause hasn't raised anything.");
  const amountRupees = Number(amountInput.replace(/[,₹\s]/g, ""));
  const what = note.trim().slice(0, 300);
  if (!(amountRupees > 0)) return no("Enter the amount paid out.");
  if (!what) return no("Say what it was for (e.g. “Semester fees, paid to the college”).");
  const [cause] = await toCauses([row], me);
  const amount = Math.round(amountRupees * 100);
  if (cause.paidOut + amount > cause.raised) return no(`That's more than is left: ${rupees(cause.raised - cause.paidOut)}.`);
  await db().run("insert into cause_payouts (cause_id, amount, note, paid_by, created_at) values (?, ?, ?, ?, ?)", id, amount, what, me.id, Date.now());
  const { audit } = await import("./desk");
  await audit(me, "recorded payout", `cause ${id}`, `${rupees(amount)}: ${what}`);
  return { ok: true };
}

export type Payout = { amount: number; note: string; at: number };

/** What has been paid out to a cause (public, like the total raised). */
export async function payouts(viewer: User, id: number): Promise<Payout[]> {
  const row = await causeRow(id);
  if (!row || !mayView(viewer, row)) return [];
  return (await db().all<{ amount: number; note: string; created_at: number }>("select amount, note, created_at from cause_payouts where cause_id = ? order by created_at desc", id)).map((p) => ({
    amount: p.amount,
    note: p.note,
    at: p.created_at
  }));
}

/** Every paid donation, for the college's accounts (administrators): a spreadsheet. */
export async function donationsCsv(me: User): Promise<string | null> {
  if (!isAdmin(me)) return null;
  const rows = await db().all<{ paid_at: number; title: string; name: string | null; email: string | null; amount: number; payment_id: string; order_id: string; anonymous: number }>(
    `select donations.paid_at, causes.title, users.name, users.email, donations.amount, donations.payment_id, donations.order_id, donations.anonymous
     from donations join causes on causes.id = donations.cause_id left join users on users.id = donations.donor
     where donations.status = 'paid' order by donations.paid_at desc limit 50000`
  );
  const cell = (value: string | null) => {
    const s = value ?? "";
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [new Date(r.paid_at).toISOString(), r.title, r.name ?? "", r.email ?? "", (r.amount / 100).toFixed(2), r.payment_id, r.order_id, r.anonymous ? "yes" : "no"].map(cell).join(",")
  );
  return ["paid_at,cause,donor,email,amount_inr,razorpay_payment,razorpay_order,asked_not_to_be_named", ...lines].join("\r\n") + "\r\n";
}
