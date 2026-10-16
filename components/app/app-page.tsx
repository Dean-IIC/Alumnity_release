import type { ReactNode } from "react";
import type { User } from "../../lib/server/auth";
import { photoIdsOf } from "../../lib/server/profile";
import { unreadMessages, unreadNotifications, waitingRequests } from "../../lib/server/social";
import { SiteFooter } from "../site-footer";
import { BackLink } from "../back-link";
import { AppBar } from "./app-bar";
import { Pulse } from "./pulse";
import { Icon } from "../social/icons";
import "../../app/styles/wire.css";
import "../../app/styles/social.css";
import "../../app/styles/app-bar.css";

export type Section = "home" | "people" | "connections" | "messages" | "ask" | "events" | "groups" | "causes" | "notifications" | "desk" | "batch" | "me";

const Count = ({ n }: { n: number }) =>
  n ? (
    <>
      <span className="wf-count" aria-hidden="true">
        {n > 99 ? "99+" : n}
      </span>
      <span className="sr-only">, {n} new</span>
    </>
  ) : null;

/**
 * Every signed-in page: the app bar (with what's waiting in each place), the page, the
 * footer; on a phone, a tab bar at the bottom for the places people go most.
 * `bare`: the page lays itself out (the feed), with no heading of ours.
 */
export async function AppPage({
  user,
  current,
  title,
  intro,
  children,
  bare = false,
  thread,
  back
}: {
  user: User;
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
  const [connections, messages, notifications, photos] = await Promise.all([
    waitingRequests(user.id),
    unreadMessages(user.id),
    unreadNotifications(user.id),
    photoIdsOf([user.id])
  ]);
  const counts = { connections, messages, notifications };
  const tab = (key: Section) => (key === current ? ("page" as const) : undefined);
  return (
    <>
      <AppBar user={user} current={current} counts={counts} photoId={photos.get(user.id) ?? null} />
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
      <SiteFooter />
      <Pulse counts={{ n: notifications, m: messages, r: connections }} thread={thread} />
      {/* On a phone: the five places people go most, always in reach of a thumb. */}
      <nav className="tab-bar" aria-label="Main">
        <a href="/home" aria-current={tab("home")}>
          <Icon name="home" size={24} />
          Home
        </a>
        <a href="/people" aria-current={tab("people")}>
          <Icon name="people" size={24} />
          People
          <Count n={counts.connections} />
        </a>
        <a href="/home#compose" aria-label="New post">
          <span className="tab-bar__post">
            <Icon name="plus" size={24} />
          </span>
        </a>
        <a href="/messages" aria-current={tab("messages")}>
          <Icon name="message" size={24} />
          Messages
          <Count n={counts.messages} />
        </a>
        <a href="/me" aria-current={tab("me")}>
          <Icon name="you" size={24} />
          You
        </a>
      </nav>
    </>
  );
}
