import Link from "next/link";
import type { User } from "../../lib/server/auth";
import { isModerator } from "../../lib/server/roles";
import { BrandLockup } from "../brand-lockup";
import { ABOUT_LINKS } from "../../lib/footer-links";
import { LogOutButton } from "../join/log-out-button";
import { Avatar } from "../social/avatar";
import { Icon, type IconName } from "../social/icons";
import { MenuCloser } from "./menu-closer";
import { MenuMark, NavLink } from "./nav-link";

/*
 * The bar along the top of every signed-in page, as in any social app: the wordmark, a
 * search for people, the five places people go most (with what's waiting in each), a
 * menu of everything else, and your own menu. It stays in place as you move between
 * pages (app/(member)/layout.tsx). On a phone it slims to the wordmark and a few icons;
 * the tab bar at the bottom takes the rest.
 */

export type Counts = { connections: number; messages: number; notifications: number };

const MAIN: { key: string; href: string; label: string; icon: IconName; count?: keyof Counts; match?: string[] }[] = [
  { key: "home", href: "/home", label: "Home", icon: "home", match: ["/home", "/notes"] },
  { key: "people", href: "/people", label: "Network", icon: "people", count: "connections" },
  { key: "groups", href: "/groups", label: "Groups", icon: "group" },
  { key: "messages", href: "/messages", label: "Messages", icon: "message", count: "messages" },
  { key: "notifications", href: "/notifications", label: "Notifications", icon: "bell", count: "notifications" }
];

export const MORE: { href: string; label: string; icon: IconName; note: string }[] = [
  { href: "/ask", label: "Ask a senior", icon: "ask", note: "Get answers from alumni who can help" },
  { href: "/board", label: "HKBK board", icon: "briefcase", note: "Jobs, internships and notices checked by the college" },
  { href: "/events", label: "Events", icon: "event", note: "Reunions, talks, college days" },
  { href: "/causes", label: "Causes", icon: "heart", note: "Give to scholarships and people in need" },
  { href: "/batch", label: "Your batch", icon: "batch", note: "Everyone from your year" },
  { href: "/connections", label: "Connections", icon: "connections", note: "Your connections and connection requests" },
  { href: "/gallery", label: "Gallery", icon: "photo", note: "Photos of HKBK over the years" }
];

/** What a badge counts, said in words for screen readers ("1 connection request"). */
const BADGE_WORDS: Record<string, [string, string]> = {
  connections: ["connection request", "connection requests"],
  messages: ["unread message", "unread messages"],
  notifications: ["new notification", "new notifications"]
};

export function Badge({ n, of }: { n: number; of?: keyof typeof BADGE_WORDS }) {
  if (!n) return null;
  const words = of ? BADGE_WORDS[of][n === 1 ? 0 : 1] : "new";
  return (
    <>
      <span className="wf-count app-bar__badge" aria-hidden="true">
        {n > 99 ? "99+" : n}
      </span>
      <span className="sr-only">
        , {n} {words}
      </span>
    </>
  );
}

export function AppBar({ user, counts, photoId }: { user: User; counts: Counts; photoId: string | null }) {
  return (
    <header className="app-bar">
      <div className="app-bar__inner container">
        <NavLink className="app-bar__brand" href="/home" match={[]} aria-label="Alumnity, go to Home">
          <BrandLockup />
        </NavLink>

        <form className="app-bar__search" role="search" aria-label="Search Alumnity" action="/people">
          <label className="sr-only" htmlFor="app-search">
            Search people
          </label>
          <Icon name="search" size={18} />
          <input id="app-search" name="q" type="search" placeholder="Search people, companies, skills" maxLength={100} autoComplete="off" />
          <span className="app-bar__search-short" aria-hidden="true">
            Search
          </span>
        </form>

        <nav className="app-bar__nav" aria-label="Main">
          {MAIN.map((m) => (
            <NavLink key={m.key} href={m.href} match={m.match} className={`app-bar__tab app-bar__tab--${m.key}`}>
              <span className="app-bar__icon">
                <Icon name={m.icon} size={24} />
                {m.count && <Badge n={counts[m.count]} of={m.count} />}
              </span>
              <span className="app-bar__label">{m.label}</span>
            </NavLink>
          ))}

          <details className="app-menu app-bar__more">
            <MenuMark className="app-bar__tab" match={MORE.map((m) => m.href)}>
              <span className="app-bar__icon">
                <Icon name="grid" size={24} />
              </span>
              <span className="app-bar__label">More</span>
            </MenuMark>
            <div className="app-menu__panel app-menu__panel--wide">
              {MORE.map((m) => (
                <NavLink key={m.href} href={m.href} className="app-menu__item">
                  <Icon name={m.icon} size={22} />
                  <span>
                    <strong>{m.label}</strong>
                    <small>{m.note}</small>
                  </span>
                </NavLink>
              ))}
              {/* Your own links, here as well as under You: a phone has no You menu up here (its tab
                  bar's You goes straight to your page), and on a laptop a blind test looked here. */}
              <div className="app-menu__you" role="group" aria-label="You">
                <NavLink href="/me/edit" className="app-menu__item">
                  <Icon name="you" size={22} />
                  <span>
                    <strong>Edit your page</strong>
                  </span>
                </NavLink>
                <NavLink href="/settings" className="app-menu__item">
                  <Icon name="settings" size={22} />
                  <span>
                    <strong>Settings</strong>
                    <small>Password, notifications, dark mode</small>
                  </span>
                </NavLink>
                <LogOutButton className="app-menu__item app-menu__logout">
                  <Icon name="logout" size={22} />
                </LogOutButton>
              </div>
              {/* The pages about Alumnity: Home has no footer, so they're here too (and in its right column). */}
              <nav className="app-menu__about" aria-label="About Alumnity">
                {ABOUT_LINKS.filter(([href]) => href !== "/gallery").map(([href, label]) => (
                  <Link key={href} href={href}>
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </details>

          <details className="app-menu app-bar__me">
            <MenuMark className="app-bar__tab" match={["/me", "/settings", "/desk"]}>
              <span className="app-bar__icon">
                <Avatar name={user.name} photoId={photoId} size={28} />
              </span>
              <span className="app-bar__label">You</span>
            </MenuMark>
            <div className="app-menu__panel">
              <NavLink href="/me" className="app-menu__item app-menu__item--me">
                <Avatar name={user.name} photoId={photoId} size={44} />
                <span>
                  <strong>{user.name}</strong>
                  <small>See your page</small>
                </span>
              </NavLink>
              <NavLink href="/me/edit" className="app-menu__item">
                <Icon name="you" size={22} />
                <span>Edit your page</span>
              </NavLink>
              <NavLink href="/me/activity" className="app-menu__item">
                <Icon name="bell" size={22} />
                <span>Your activity</span>
              </NavLink>
              <NavLink href="/settings" className="app-menu__item">
                <Icon name="settings" size={22} />
                <span>Settings and notifications</span>
              </NavLink>
              {isModerator(user) && (
                <NavLink href="/desk" className="app-menu__item">
                  <Icon name="shield" size={22} />
                  <span>College desk</span>
                </NavLink>
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

/** On a phone: the five places people go most, always in reach of a thumb. */
export function TabBar({ counts }: { counts: Counts }) {
  return (
    <nav className="tab-bar" aria-label="Bottom bar">
      <NavLink href="/home" match={["/home", "/notes"]}>
        <Icon name="home" size={24} />
        Home
      </NavLink>
      <NavLink href="/people">
        <Icon name="people" size={24} />
        Network
        <Badge n={counts.connections} of="connections" />
      </NavLink>
      {/* Named, like the rest: a bare + was never tried by the blind test, looking to post. */}
      <a href="/home#compose">
        <span className="tab-bar__post">
          <Icon name="plus" size={22} />
        </span>
        Post
      </a>
      <NavLink href="/messages">
        <Icon name="message" size={24} />
        Messages
        <Badge n={counts.messages} of="messages" />
      </NavLink>
      <NavLink href="/me" match={["/me", "/settings"]}>
        <Icon name="you" size={24} />
        You
      </NavLink>
    </nav>
  );
}
