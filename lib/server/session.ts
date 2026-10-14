import { cookies } from "next/headers";
import { userForSession, type User } from "./auth";
import { SESSION_COOKIE } from "./http";

/** Who's signed in, for a server component (null if nobody). */
export async function currentUser(): Promise<User | null> {
  return userForSession((await cookies()).get(SESSION_COOKIE)?.value);
}
