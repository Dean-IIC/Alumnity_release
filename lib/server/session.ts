import { redirect } from "next/navigation";
import { cache } from "react";
import { signedInUser, type User } from "./auth";

/** Who's signed in, for a server component (null if nobody). Asked once per request, however many components ask. */
export const currentUser: () => Promise<User | null> = cache(signedInUser);

/** Who's signed in; anyone else goes to log in, and comes back to `path` after. */
export async function requireUser(path: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return user;
}
