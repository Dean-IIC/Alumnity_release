"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "../action-state";
import { answerRequest, createGroup, GROUP_LIMITS, joinGroup, leaveGroup, removeGroup, setGroupRole, updateGroup } from "../server/groups";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* Groups: one action per button. The rules (lib/server/groups.ts) check who may do what. */

const groupInput = (form: FormData) => ({
  name: textFrom(form, "name", GROUP_LIMITS.name),
  about: textFrom(form, "about", GROUP_LIMITS.about),
  kind: textFrom(form, "kind", 10)
});

export async function createGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const made = await createGroup(me, groupInput(form));
  if (!made.ok) return made;
  redirect(`/groups/${made.id}`);
}

export async function joinGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await joinGroup(me, idFrom(form)));
}

export async function leaveGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await leaveGroup(me, idFrom(form)), "You've left the group.");
}

export async function answerGroupRequestAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const accept = textFrom(form, "answer", 10) === "accept";
  return answer(await answerRequest(me, idFrom(form), idFrom(form, "user"), accept), accept ? "Let in." : "Turned away. They aren't told.");
}

export async function groupRoleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const asked = textFrom(form, "action", 10);
  const action = asked === "admin" || asked === "member" || asked === "owner" ? asked : "remove";
  const done = { remove: "Removed from the group.", admin: "Made an admin.", member: "No longer an admin.", owner: "They own the group now." }[action];
  return answer(await setGroupRole(me, idFrom(form), idFrom(form, "user"), action), done);
}

export async function updateGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await updateGroup(me, idFrom(form), groupInput(form)), "Saved.");
}

export async function removeGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const done = await removeGroup(me, idFrom(form));
  if (!done.ok) return done;
  redirect("/groups");
}
