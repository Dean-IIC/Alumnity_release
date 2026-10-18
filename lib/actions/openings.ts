"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "../action-state";
import { acceptReferral, closeOpening, createOpening, OPENING_LIMITS, requestReferral } from "../server/openings";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* Jobs and referrals: one action per button. The rules (lib/server/openings.ts) check who may do what. */

export async function createOpeningAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const made = await createOpening(me, {
    kind: textFrom(form, "kind", 20),
    title: textFrom(form, "title", OPENING_LIMITS.title + 50),
    company: textFrom(form, "company", OPENING_LIMITS.company + 50),
    place: textFrom(form, "place", OPENING_LIMITS.place + 50),
    branch: textFrom(form, "branch", 10),
    link: textFrom(form, "link", OPENING_LIMITS.link + 100),
    body: textFrom(form, "body", OPENING_LIMITS.body + 100),
    canRefer: form.get("canRefer") === "on",
    days: textFrom(form, "days", 4)
  });
  if (!made.ok) return made;
  answer(made);
  redirect(`/openings/${made.id}`);
}

export async function requestReferralAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await requestReferral(me, idFrom(form), textFrom(form, "note", OPENING_LIMITS.note + 100)), "Sent. You'll get a notification when they answer.");
}

export async function acceptReferralAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await acceptReferral(me, idFrom(form), idFrom(form, "user")), "Done. You're connected: message them from here or from Messages.");
}

export async function closeOpeningAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await closeOpening(me, idFrom(form)), "Taken down.");
}
