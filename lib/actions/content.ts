"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "../action-state";
import { ASK_LIMITS, closeAsk, createAsk, markAnswered, replyToAsk, takeAsk } from "../server/asks";
import { cancelEvent, createEvent, toggleRsvp } from "../server/events";
import { addComment, COMMENT_LIMIT, createPost, MEDIA_LIMIT, POST_LIMIT, react, removeOwnComment, removeOwnPost, toggleCheer } from "../server/posts";
import { ownPost, profileOf, saveProfile } from "../server/profile";
import { CAPTION_LIMIT, createStory, markSeen, removeStory } from "../server/stories";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* Notes on Home, Asks and events. */

export async function postAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  // Uploaded first (POST /api/media); their ids come with the post.
  const media = form.getAll("media").filter((v): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{10,40}$/.test(v)).slice(0, MEDIA_LIMIT + 1);
  // A group's composer sends the group; everyone else's, who it's for.
  const group = idFrom(form, "group") || null;
  return answer(await createPost(me, textFrom(form, "body", POST_LIMIT), textFrom(form, "audience", 20), media, group), "Posted.");
}

export async function removePostAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await removeOwnPost(me, idFrom(form)), "Removed.");
}

/** Pins one of your own posts to the top of your page ("Featured"), or unpins it. */
export async function pinPostAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const unpin = form.get("unpin") === "1";
  const id = unpin ? null : await ownPost(idFrom(form), me.id);
  if (!unpin && id === null) return { ok: false, error: "Only your own posts can go at the top of your page." };
  await saveProfile(me.id, { ...(await profileOf(me.id)), featured: id });
  return answer({ ok: true }, unpin ? "Taken off the top of your page." : "Pinned to the top of your page.");
}

export async function cheerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await toggleCheer(me, idFrom(form)));
}

export async function reactAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await react(me, idFrom(form), textFrom(form, "kind", 20)));
}

/** A reaction from the feed's bar, called directly (the bar updates at once and only asks the server to agree). */
export async function reactNow(postId: number, kind: string): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  if (!Number.isSafeInteger(postId) || postId <= 0) return { ok: false, error: "That post isn't here any more." };
  const result = await react(me, postId, String(kind).slice(0, 20));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function storyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await createStory(me, textFrom(form, "media", 40), textFrom(form, "caption", CAPTION_LIMIT)), "Your story is up for 24 hours.");
}

export async function removeStoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await removeStory(me, idFrom(form)), "Story removed.");
}

/** Called by the story viewer as each story is shown (no page refresh: nothing else changes). */
export async function seenStoryAction(storyId: number): Promise<void> {
  const me = await actor();
  if (me && Number.isSafeInteger(storyId) && storyId > 0) await markSeen(me, storyId);
}

export async function commentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await addComment(me, idFrom(form), textFrom(form, "body", COMMENT_LIMIT)));
}

export async function removeCommentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await removeOwnComment(me, idFrom(form)), "Removed.");
}

export async function askAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const result = await createAsk(me, {
    title: textFrom(form, "title", ASK_LIMITS.title),
    body: textFrom(form, "body", ASK_LIMITS.body),
    topics: textFrom(form, "topics", 200)
  });
  if (!result.ok) return answer(result);
  answer(result);
  redirect(`/ask/${result.id}`);
}

export async function takeAskAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await takeAsk(me, idFrom(form)), "It's yours. Write to them below.");
}

export async function replyAskAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await replyToAsk(me, idFrom(form), textFrom(form, "body", ASK_LIMITS.reply)));
}

export async function answeredAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await markAnswered(me, idFrom(form), textFrom(form, "thanks", 300)), "Marked answered. Your thanks is on their Record.");
}

export async function closeAskAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await closeAsk(me, idFrom(form)), "Closed.");
}

export async function eventAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const result = await createEvent(me, {
    title: textFrom(form, "title", 200),
    body: textFrom(form, "body", 3000),
    startsAt: textFrom(form, "startsAt", 20),
    endsAt: textFrom(form, "endsAt", 20),
    place: textFrom(form, "place", 200),
    onlineLink: textFrom(form, "onlineLink", 400),
    capacity: textFrom(form, "capacity", 10)
  });
  if (!result.ok) return answer(result);
  answer(result);
  redirect(`/events/${result.id}`);
}

export async function rsvpAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await toggleRsvp(me, idFrom(form)));
}

export async function cancelEventAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await cancelEvent(me, idFrom(form)), "Cancelled. Everyone coming was told.");
}
