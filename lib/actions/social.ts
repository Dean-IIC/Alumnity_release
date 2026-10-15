"use server";

import type { ActionState } from "../action-state";
import { report } from "../server/desk";
import { follow, unfollow } from "../server/follows";
import { acceptConnection, block, declineConnection, markNotificationsRead, removeConnection, requestConnection, sendMessage, unblock, withdrawRequest, NOTE_LIMIT, MESSAGE_LIMIT } from "../server/social";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* Connections, blocks, messages, notifications and reports: one action per button. */

export async function connectAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(requestConnection(me, idFrom(form), textFrom(form, "note", NOTE_LIMIT)), "Request sent.");
}

export async function acceptAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(acceptConnection(me, idFrom(form)), "You're connected.");
}

export async function declineAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(declineConnection(me, idFrom(form)), "Declined. They aren't told.");
}

export async function withdrawAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(withdrawRequest(me, idFrom(form)), "Request withdrawn.");
}

export async function removeConnectionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(removeConnection(me, idFrom(form)), "Connection removed.");
}

export async function blockAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(block(me, idFrom(form)), "Blocked. You won't see each other anywhere on Alumnity.");
}

export async function unblockAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(unblock(me, idFrom(form)), "Unblocked.");
}

export async function followAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(follow(me, idFrom(form)), "Following.");
}

export async function unfollowAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(unfollow(me, idFrom(form)), "Unfollowed.");
}

export async function messageAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(sendMessage(me, idFrom(form), textFrom(form, "body", MESSAGE_LIMIT)));
}

export async function readAllAction(_: ActionState): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  markNotificationsRead(me.id);
  return answer({ ok: true });
}

export async function reportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(report(me, textFrom(form, "kind", 20), idFrom(form), textFrom(form, "reason", 500)), "Thank you. The college desk will look at it; they won't say who reported it.");
}
