"use server";

import type { ActionState } from "../action-state";
import { isLocalDev } from "../server/dev-only";
import { addSamples, removeSamples } from "../server/samples";
import { actor, answer } from "./common";

/* Development only (the rules refuse in production). */

export async function addSamplesAction(_: ActionState): Promise<ActionState> {
  if (!(await isLocalDev())) return { ok: false, error: "Not available." };
  const added = await addSamples(await actor());
  return answer({ ok: true }, added ? `Added ${added} sample members.` : "The sample members are already here.");
}

export async function removeSamplesAction(_: ActionState): Promise<ActionState> {
  if (!(await isLocalDev())) return { ok: false, error: "Not available." };
  return answer({ ok: true }, `Removed ${await removeSamples()} sample members and everything they made.`);
}
