import { revalidatePath } from "next/cache";
import type { ActionState } from "../action-state";
import type { User } from "../server/auth";
import { currentUser } from "../server/session";
import type { Result } from "../server/social";

/*
 * What every form action shares. Next checks that a server action is called from this
 * site (its Origin must match), so a form elsewhere can't act for a member; each action
 * still checks who's signed in, and the rules in lib/server check what they may do.
 */

export const SIGNED_OUT: ActionState = { ok: false, error: "Please log in again." };

/** Who's acting, or null (then answer SIGNED_OUT). */
export const actor = (): Promise<User | null> => currentUser();

/** A positive whole number from the form (an id), or 0. */
export function idFrom(form: FormData, key = "id"): number {
  const value = Number(form.get(key));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

/** Text from the form, at most `max` characters. */
export function textFrom(form: FormData, key: string, max = 2000): string {
  const value = form.get(key);
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** The answer to show, refreshing every page's data (and the nav's counts) when it worked. */
export function answer(result: Result, message?: string): ActionState {
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message };
}
