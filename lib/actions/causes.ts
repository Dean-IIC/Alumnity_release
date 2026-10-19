"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "../action-state";
import { CAUSE_LIMITS, closeCause, confirmDonation, proposeCause, recordPayout, reviewCause, startDonation, type Checkout } from "../server/causes";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* Causes and giving. The rules (lib/server/causes.ts) check who may do what, and every payment is verified there. */

export async function proposeCauseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const made = await proposeCause(me, {
    title: textFrom(form, "title", CAUSE_LIMITS.title),
    story: textFrom(form, "story", CAUSE_LIMITS.story),
    goal: textFrom(form, "goal", 20),
    cover: textFrom(form, "cover", 64),
    days: textFrom(form, "days", 4)
  });
  if (!made.ok) return made;
  redirect(`/causes/${made.id}`);
}

export async function reviewCauseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const approve = textFrom(form, "answer", 10) === "approve";
  return answer(await reviewCause(me, idFrom(form), approve, textFrom(form, "note", 500)), approve ? "Approved. The cause is now live." : "Rejected. The person who started it can see your note.");
}

export async function closeCauseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await closeCause(me, idFrom(form), textFrom(form, "note", 500)), "Cause closed. Past donations stay on record.");
}

export async function payoutAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await recordPayout(me, idFrom(form), textFrom(form, "amount", 20), textFrom(form, "note", 300)), "Payout recorded.");
}

/** Called by the Give button: an order to open Razorpay Checkout with. */
export async function startDonationNow(causeId: number, amount: string, anonymous: boolean, message: string): Promise<Checkout> {
  const me = await actor();
  if (!me) return { ok: false, error: "Please log in again." };
  if (!Number.isSafeInteger(causeId) || causeId <= 0) return { ok: false, error: "This cause is not taking donations now." };
  return startDonation(me, causeId, { amount: String(amount).slice(0, 20), anonymous: Boolean(anonymous), message: String(message).slice(0, CAUSE_LIMITS.message) });
}

/** Called when Checkout says it's paid: counted only if Razorpay's signature checks out. */
export async function confirmDonationNow(orderId: string, paymentId: string, signature: string): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const done = await confirmDonation(me, String(orderId).slice(0, 60), String(paymentId).slice(0, 60), String(signature).slice(0, 200));
  if (done.ok) revalidatePath("/causes", "layout");
  return done.ok ? { ok: true, message: "Thank you. We got your donation." } : done;
}
