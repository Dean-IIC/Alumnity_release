"use server";

import type { ActionState } from "../action-state";
import { report } from "../server/desk";
import { follow, unfollow } from "../server/follows";
import { acceptConnection, block, declineConnection, markNotificationsRead, removeConnection, requestConnection, sendMessage, unblock, withdrawRequest, NOTE_LIMIT, MESSAGE_LIMIT } from "../server/social";
import { askForReferral } from "../server/posts";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* Connections, blocks, messages, notifications and reports: one action per button. */

export async function connectAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await requestConnection(me, idFrom(form), textFrom(form, "note", NOTE_LIMIT)), "Request sent.");
}

/** "Ask for a referral" on a #job post: a connection request with the note, or a message if you're connected. */
export async function referralAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const asked = await askForReferral(me, idFrom(form), textFrom(form, "note", 1500));
  return answer(asked, asked.ok && asked.as === "message" ? "Sent to them in Messages." : "Sent with a connection request. When they accept, you can message each other.");
}

export async function acceptAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await acceptConnection(me, idFrom(form)), "You're connected.");
}

export async function declineAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await declineConnection(me, idFrom(form)), "Declined. They aren't told.");
}

export async function withdrawAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await withdrawRequest(me, idFrom(form)), "Request withdrawn.");
}

export async function removeConnectionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await removeConnection(me, idFrom(form)), "Connection removed.");
}

export async function blockAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await block(me, idFrom(form)), "Blocked. You won't see each other anywhere on Alumnity.");
}

export async function unblockAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await unblock(me, idFrom(form)), "Unblocked.");
}

export async function followAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await follow(me, idFrom(form)), "Following.");
}

export async function unfollowAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await unfollow(me, idFrom(form)), "Unfollowed.");
}

export async function messageAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await sendMessage(me, idFrom(form), textFrom(form, "body", MESSAGE_LIMIT)));
}

export async function readAllAction(_: ActionState): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  await markNotificationsRead(me.id);
  return answer({ ok: true });
}

export async function reportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await report(me, textFrom(form, "kind", 20), idFrom(form), textFrom(form, "reason", 500)), "Thank you. The college desk will look at it; they won't say who reported it.");
}

/** "I'm happy to mentor", in one tap (from Home or Ask a senior): questions that fit start reaching them. */
export async function mentorAction(_: ActionState): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const { profileOf, saveProfile } = await import("../server/profile");
  const profile = await profileOf(me.id);
  await saveProfile(me.id, { ...profile, happyTo: { ...profile.happyTo, mentor: true } });
  return answer({ ok: true }, "Done. Questions that fit what you know will reach you here.");
}
