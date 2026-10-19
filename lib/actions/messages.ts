"use server";

import type { ActionState } from "../action-state";
import { replyToStory, STORY_REPLY_LIMIT } from "../server/stories";
import { MESSAGE_LIMIT, sendMessage } from "../server/social";
import { actor, answer, SIGNED_OUT } from "./common";

/*
 * Messages sent from the chat's composer and from the story viewer. Both are called
 * directly (not as a form's action), so the composer can keep what was typed when sending
 * fails: a form action clears its fields whatever the answer, and a refused message was lost.
 */

const validId = (id: unknown) => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

/** A message in an open conversation. Every page's data (and the bar's counts) refreshes when it's sent. */
export async function sendMessageNow(toId: number, body: string): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!validId(toId)) return { ok: false, error: "That member isn't here any more." };
  return answer(await sendMessage(me, toId, String(body ?? "").slice(0, MESSAGE_LIMIT)));
}

/**
 * A reply to a story, or a quick reaction. Nothing on the page needs redrawing (it's in
 * the author's Messages), and redrawing Home would reorder the stories under the viewer.
 */
export async function storyReplyNow(storyId: number, reply: { text?: string; reaction?: string }): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!validId(storyId)) return { ok: false, error: "That story isn't here any more." };
  const result = await replyToStory(me, storyId, {
    ...(typeof reply?.reaction === "string" ? { reaction: reply.reaction.slice(0, 16) } : {}),
    ...(typeof reply?.text === "string" ? { text: reply.text.slice(0, STORY_REPLY_LIMIT) } : {})
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
