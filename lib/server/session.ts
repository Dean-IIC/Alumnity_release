import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userForSession, type User } from "./auth";
import { SESSION_COOKIE } from "./http";

/** Who's signed in, for a server component (null if nobody). */
export async function currentUser(): Promise<User | null> {
  return userForSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Who's signed in; anyone else goes to log in, and comes back to `path` after. */
export async function requireUser(path: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return user;
}
