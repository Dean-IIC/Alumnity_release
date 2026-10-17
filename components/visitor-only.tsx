import type { ReactNode } from "react";
import { currentUser } from "../lib/server/session";

/**
 * Shown only to someone not signed in: the visitors' header and footer on a page members
 * also open (the gallery), where members get the app's own bar and tabs instead.
 */
export async function VisitorOnly({ children }: { children: ReactNode }) {
  return (await currentUser()) ? null : children;
}
