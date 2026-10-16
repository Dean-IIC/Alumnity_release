import type { ReactNode } from "react";
import { AppBar, TabBar } from "../../components/app/app-bar";
import { Pulse } from "../../components/app/pulse";
import { SidePatterns } from "../../components/side-patterns";
import { SiteFooter } from "../../components/site-footer";
import { photoIdsOf } from "../../lib/server/profile";
import { currentUser } from "../../lib/server/session";
import { unreadMessages, unreadNotifications, waitingRequests } from "../../lib/server/social";
import "../styles/wire.css";
import "../styles/social.css";
import "../styles/app-bar.css";

/*
 * Around every signed-in page: the app bar, the phone's tab bar, the footer, and the
 * pulse that keeps the counts in them current. They stay in place as members move between
 * pages (each page swaps in under the bar without the whole site reloading). Nobody signed
 * in: the page itself sends them to log in.
 */
export default async function MemberLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) return children;
  const [connections, messages, notifications, photos] = await Promise.all([
    waitingRequests(user.id),
    unreadMessages(user.id),
    unreadNotifications(user.id),
    photoIdsOf([user.id])
  ]);
  const counts = { connections, messages, notifications };
  return (
    <>
      {/* The paper's margins: the landing page's hand-drawn patterns, faint, behind everything. */}
      <div className="app-paper" aria-hidden="true">
        <SidePatterns />
      </div>
      <AppBar user={user} counts={counts} photoId={photos.get(user.id) ?? null} />
      {children}
      <SiteFooter />
      <Pulse counts={{ n: notifications, m: messages, r: connections }} />
      <TabBar counts={counts} />
    </>
  );
}
