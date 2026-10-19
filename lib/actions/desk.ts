"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "../action-state";
import { createAnnouncement, removeAnnouncement, ANNOUNCEMENT_LIMITS } from "../server/announcements";
import { deleteMember, resolveReport, restore, setRole, signOutEverywhere, suspend, takeDown, updateSettings, type ContentKind } from "../server/desk";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* The college desk's buttons. The rules (lib/server/desk.ts) check the role every time. */

const contentKind = (form: FormData): ContentKind | null => {
  const k = textFrom(form, "kind", 10);
  return k === "post" || k === "comment" || k === "ask" ? k : null;
};

export async function resolveReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const action = textFrom(form, "action", 10) === "remove" ? "remove" : "dismiss";
  return answer(await resolveReport(me, idFrom(form), action), action === "remove" ? "Taken down." : "Dismissed.");
}

export async function pauseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const paused = textFrom(form, "paused", 5) === "1";
  return answer(await suspend(me, idFrom(form), paused), paused ? "Paused, and logged out everywhere." : "Unpaused.");
}

export async function signOutAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await signOutEverywhere(me, idFrom(form)), "Logged out on every device.");
}

export async function roleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await setRole(me, idFrom(form), textFrom(form, "role", 20)), "Role changed.");
}

export async function deleteMemberAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const result = await deleteMember(me, idFrom(form), textFrom(form, "confirm", 200));
  if (!result.ok) return answer(result);
  answer(result);
  redirect("/desk?tab=members");
}

export async function takeDownAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const kind = contentKind(form);
  if (!kind) return { ok: false, error: "That can't be taken down here." };
  return answer(await takeDown(me, kind, idFrom(form)), "Taken down. Its author was told.");
}

export async function restoreAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const kind = contentKind(form);
  if (!kind) return { ok: false, error: "That can't be brought back." };
  return answer(await restore(me, kind, idFrom(form)), "Brought back.");
}

export async function announceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(
    await createAnnouncement(me, {
      title: textFrom(form, "title", ANNOUNCEMENT_LIMITS.title),
      body: textFrom(form, "body", ANNOUNCEMENT_LIMITS.body),
      days: Number(textFrom(form, "days", 4))
    }),
    "Announced. It's at the top of everyone's Home."
  );
}

export async function removeAnnouncementAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await removeAnnouncement(me, idFrom(form)), "Taken down.");
}

export async function settingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const on = (key: string) => form.get(key) === "on";
  return answer(
    await updateSettings(me, {
      joiningOpen: on("joiningOpen"),
      features: { notes: on("notes"), asks: on("asks"), events: on("events"), messages: on("messages") },
      dailyRequests: Number(textFrom(form, "dailyRequests", 4))
    }),
    "Saved. It's in the audit log."
  );
}

export async function inviteStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const { headers } = await import("next/headers");
  const h = await headers();
  const origin = process.env.SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const { inviteStaff } = await import("../server/staff");
  const done = await inviteStaff(
    me,
    { email: textFrom(form, "email", 254), name: textFrom(form, "name", 100), role: textFrom(form, "role", 20), branch: textFrom(form, "branch", 10) },
    origin
  );
  return answer(done, "Invited. They'll get an email with a link to join; it works for two weeks.");
}

export async function revokeInviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const { revokeInvite } = await import("../server/staff");
  return answer(await revokeInvite(me, textFrom(form, "email", 254)), "Invitation withdrawn.");
}
