import type { User } from "../../lib/server/auth";
import { isModerator } from "../../lib/server/roles";
import { BrandLockup } from "../brand-lockup";
import { LogOutButton } from "../join/log-out-button";
import { Avatar } from "../social/avatar";
import { Icon, type IconName } from "../social/icons";
import { MenuCloser } from "./menu-closer";
import type { Section } from "./app-page";

/*
 * The bar along the top of every signed-in page, as in any social app: the wordmark, a
 * search for people, the five places people go most (with what's waiting in each), a
 * menu of everything else, and your own menu. On a phone it slims to the wordmark and a
 * few icons; the tab bar at the bottom (in AppPage) takes the rest.
 */

type Counts = { connections: number; messages: number; notifications: number };

const MAIN: { key: Section; href: string; label: string; icon: IconName; count?: keyof Counts }[] = [
  { key: "home", href: "/home", label: "Home", icon: "home" },
  { key: "people", href: "/people", label: "People", icon: "people", count: "connections" },
  { key: "groups", href: "/groups", label: "Groups", icon: "group" },
  { key: "messages", href: "/messages", label: "Messages", icon: "message", count: "messages" },
  { key: "notifications", href: "/notifications", label: "Notifications", icon: "bell", count: "notifications" }
];

export const MORE: { key: Section; href: string; label: string; icon: IconName; note: string }[] = [
  { key: "ask", href: "/ask", label: "Ask a senior", icon: "ask", note: "Questions to alumni who fit them" },
  { key: "events", href: "/events", label: "Events", icon: "event", note: "Reunions, talks, college days" },
  { key: "causes", href: "/causes", label: "Causes", icon: "heart", note: "Give to what HKBK people care about" },
  { key: "batch", href: "/batch", label: "Your batch", icon: "batch", note: "Everyone from your year" },
  { key: "connections", href: "/connections", label: "Connections", icon: "connections", note: "Requests, and the people you know" }
];

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <>
      <span className="wf-count app-bar__badge" aria-hidden="true">
        {n > 99 ? "99+" : n}
      </span>
      <span className="sr-only">, {n} new</span>
    </>
  );
}

export function AppBar({ user, current, counts, photoId }: { user: User; current: Section; counts: Counts; photoId: string | null }) {
  const inMore = MORE.some((m) => m.key === current);
  return (
    <header className="app-bar">
      <div className="app-bar__inner container">
        <a className="app-bar__brand" href="/home" aria-label="Alumnity, your Home">
          <BrandLockup />
        </a>

        <form className="app-bar__search" role="search" action="/people">
          <label className="sr-only" htmlFor="app-search">
            Search people
          </label>
          <Icon name="search" size={18} />
          <input id="app-search" name="q" type="search" placeholder="Search people, companies, skills" maxLength={100} autoComplete="off" />
        </form>

        <nav className="app-bar__nav" aria-label="Main">
          {MAIN.map((m) => (
            <a key={m.key} href={m.href} className={`app-bar__tab app-bar__tab--${m.key}`} aria-current={m.key === current ? "page" : undefined}>
              <span className="app-bar__icon">
                <Icon name={m.icon} size={24} />
                {m.count && <Badge n={counts[m.count]} />}
              </span>
              <span className="app-bar__label">{m.label}</span>
            </a>
          ))}

          <details className="app-menu app-bar__more">
            <summary className="app-bar__tab" aria-current={inMore ? "page" : undefined}>
              <span className="app-bar__icon">
                <Icon name="grid" size={24} />
              </span>
              <span className="app-bar__label">More</span>
            </summary>
            <div className="app-menu__panel app-menu__panel--wide">
              {MORE.map((m) => (
                <a key={m.key} href={m.href} className="app-menu__item" aria-current={m.key === current ? "page" : undefined}>
                  <Icon name={m.icon} size={22} />
                  <span>
                    <strong>{m.label}</strong>
                    <small>{m.note}</small>
                  </span>
                </a>
              ))}
            </div>
          </details>

          <details className="app-menu app-bar__me">
            <summary className="app-bar__tab" aria-current={current === "me" || current === "desk" ? "page" : undefined}>
              <span className="app-bar__icon">
                <Avatar name={user.name} photoId={photoId} size={28} />
              </span>
              <span className="app-bar__label">You</span>
            </summary>
            <div className="app-menu__panel">
              <a href="/me" className="app-menu__item app-menu__item--me">
                <Avatar name={user.name} photoId={photoId} size={44} />
                <span>
                  <strong>{user.name}</strong>
                  <small>See your page</small>
                </span>
              </a>
              <a href="/me/edit" className="app-menu__item">
                <Icon name="you" size={22} />
                <span>Edit your page</span>
              </a>
              <a href="/settings" className="app-menu__item">
                <Icon name="settings" size={22} />
                <span>Settings and alerts</span>
              </a>
              {isModerator(user) && (
                <a href="/desk" className="app-menu__item" aria-current={current === "desk" ? "page" : undefined}>
                  <Icon name="shield" size={22} />
                  <span>College desk</span>
                </a>
              )}
              <LogOutButton className="app-menu__item app-menu__logout">
                <Icon name="logout" size={22} />
              </LogOutButton>
            </div>
          </details>
        </nav>
      </div>
      <MenuCloser />
    </header>
  );
}
