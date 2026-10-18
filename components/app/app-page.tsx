import type { ReactNode } from "react";
import type { User } from "../../lib/server/auth";
import { BackLink } from "../back-link";
import { Pulse } from "./pulse";
import "../../app/styles/wire.css";
import "../../app/styles/social.css";
import "../../app/styles/app-bar.css";

export type Section = "home" | "people" | "connections" | "messages" | "ask" | "events" | "groups" | "causes" | "board" | "notifications" | "desk" | "batch" | "me";

/**
 * A signed-in page's own part: a way back, its heading, and what's on it. The bar, the
 * phone's tab bar and the footer are around every such page already, and stay in place
 * between them (app/(member)/layout.tsx).
 * `bare`: the page lays itself out (the feed), with no heading of ours.
 */
export function AppPage({
  title,
  intro,
  children,
  bare = false,
  thread,
  back
}: {
  /** Who's signed in (the page has already checked). */
  user: User;
  /** Kept for the pages' own use; the bar works out the section from the address. */
  current: Section;
  title?: string;
  intro?: ReactNode;
  children: ReactNode;
  bare?: boolean;
  /** An open conversation, kept up to date more often. */
  thread?: { with: number; latest: number };
  /** A page inside a section: the way back to it (or to wherever you came from). */
  back?: { href: string; label: string };
}) {
  return (
    <>
      {bare ? (
        <main className="container" id="main">
          {children}
        </main>
      ) : (
        <main className="wf container" id="main">
          {back && <BackLink fallback={back.href} label={back.label} />}
          <header className="wf-head">
            {title && <h1>{title}</h1>}
            {intro && <p className="wf-muted">{intro}</p>}
          </header>
          {children}
        </main>
      )}
      {thread && <Pulse thread={thread} />}
    </>
  );
}
