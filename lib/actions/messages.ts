"use server";

import type { ActionState } from "../action-state";
import { replyToStory, STORY_REPLY_LIMIT } from "../server/stories";
import { deleteChat, deleteMessageForEveryone, deleteMessageForMe, editMessage, MESSAGE_LIMIT, sendMessage } from "../server/social";
import { actor, answer, SIGNED_OUT } from "./common";

/*
 * Messages sent from the chat's composer and from the story viewer. Both are called
 * directly (not as a form's action), so the composer can keep what was typed when sending
 * fails: a form action clears its fields whatever the answer, and a refused message was lost.
 * Editing and deleting are called the same way, from a message's menu.
 */

const validId = (id: unknown) => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

/** A message in an open conversation. Every page's data (and the bar's counts) refreshes when it's sent. */
export async function sendMessageNow(toId: number, body: string): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!validId(toId)) return { ok: false, error: "We couldn't find that member." };
  return answer(await sendMessage(me, toId, String(body ?? "").slice(0, MESSAGE_LIMIT)));
}

const GONE: ActionState = { ok: false, error: "We couldn't find that message." };

/** Your own message, rewritten (within 15 minutes of sending it). */
export async function editMessageNow(id: number, body: string): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!validId(id)) return GONE;
  return answer(await editMessage(me, id, String(body ?? "").slice(0, MESSAGE_LIMIT)));
}

/** A message deleted: `everyone` (your own: its words are cleared for both), or for you only. */
export async function deleteMessageNow(id: number, everyone: boolean): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!validId(id)) return GONE;
  return answer(await (everyone === true ? deleteMessageForEveryone(me, id) : deleteMessageForMe(me, id)));
}

/** A whole conversation deleted for you (the other still has it). */
export async function deleteChatNow(otherId: number): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!validId(otherId)) return { ok: false, error: "We couldn't find that conversation." };
  return answer(await deleteChat(me, otherId));
}

/**
 * A reply to a story, or a quick reaction. Nothing on the page needs redrawing (it's in
 * the author's Messages), and redrawing Home would reorder the stories under the viewer.
 */
export async function storyReplyNow(storyId: number, reply: { text?: string; reaction?: string }): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!validId(storyId)) return { ok: false, error: "This story is no longer available." };
  const result = await replyToStory(me, storyId, {
    ...(typeof reply?.reaction === "string" ? { reaction: reply.reaction.slice(0, 16) } : {}),
    ...(typeof reply?.text === "string" ? { text: reply.text.slice(0, STORY_REPLY_LIMIT) } : {})
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
