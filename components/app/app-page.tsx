import type { ReactNode } from "react";
import type { User } from "../../lib/server/auth";
import { isModerator } from "../../lib/server/roles";
import { unreadMessages, unreadNotifications, waitingRequests } from "../../lib/server/social";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { Icon } from "../social/icons";
import "../../app/styles/wire.css";
import "../../app/styles/social.css";

export type Section = "home" | "people" | "connections" | "messages" | "ask" | "events" | "notifications" | "desk" | "batch" | "me";

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
 * Every signed-in page: the site header, the members' sections (with what's waiting in
 * each), the page, the footer; on a phone, a tab bar at the bottom instead of the sections.
 * `bare`: the page lays itself out (the feed), with no heading of ours.
 */
export function AppPage({ user, current, title, intro, children, bare = false }: { user: User; current: Section; title?: string; intro?: ReactNode; children: ReactNode; bare?: boolean }) {
  const counts = {
    connections: waitingRequests(user.id),
    messages: unreadMessages(user.id),
    notifications: unreadNotifications(user.id)
  };
  const links: { key: Section; href: string; label: string; count?: number }[] = [
    { key: "home", href: "/home", label: "Home" },
    { key: "people", href: "/people", label: "People" },
    { key: "connections", href: "/connections", label: "Connections", count: counts.connections },
    { key: "messages", href: "/messages", label: "Messages", count: counts.messages },
    { key: "ask", href: "/ask", label: "Ask a senior" },
    { key: "events", href: "/events", label: "Events" },
    { key: "batch", href: "/batch", label: "Your batch" },
    { key: "notifications", href: "/notifications", label: "Notifications", count: counts.notifications },
    ...(isModerator(user) ? [{ key: "desk" as const, href: "/desk", label: "College desk" }] : [])
  ];
  const tab = (key: Section) => (key === current ? ("page" as const) : undefined);
  return (
    <>
      <SiteHeader member={{ firstName: user.name.split(" ")[0] }} />
      <nav className="wf-sections container" aria-label="Your Alumnity">
        {links.map((link) => (
          <a key={link.key} href={link.href} aria-current={tab(link.key)}>
            {link.label}
            <Count n={link.count ?? 0} />
          </a>
        ))}
      </nav>
      {bare ? (
        <main className="container" id="main">
          {children}
        </main>
      ) : (
        <main className="wf container" id="main">
          <header className="wf-head">
            {title && <h1>{title}</h1>}
            {intro && <p className="wf-muted">{intro}</p>}
          </header>
          {children}
        </main>
      )}
      <SiteFooter />
      {/* On a phone: the five places people go most, always in reach of a thumb. */}
      <nav className="tab-bar" aria-label="Main">
        <a href="/home" aria-current={tab("home")}>
          <Icon name="home" size={24} />
          Home
        </a>
        <a href="/people" aria-current={tab("people")}>
          <Icon name="people" size={24} />
          People
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
          <Count n={counts.connections} />
        </a>
      </nav>
    </>
  );
}
