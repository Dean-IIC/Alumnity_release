import type { ReactNode } from "react";
import { AppBar, TabBar } from "../../components/app/app-bar";
import { MarginArt, type HomeKind } from "../../components/app/margin-art";
import { isModerator, isSuperAdmin } from "../../lib/server/roles";
import { Pulse } from "../../components/app/pulse";
import { SiteFooter } from "../../components/site-footer";
import { photoIdsOf } from "../../lib/server/profile";
import type { User } from "../../lib/server/auth";
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
/** Whose Home it is, for its drawings. */
const homeKind = (u: User): HomeKind =>
  isSuperAdmin(u) ? "super" : isModerator(u) ? "desk" : u.role === "student" ? "student" : u.role === "faculty" ? "faculty" : "alumnus";

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
      {/* The paper's margins: a hand-drawn picture for each part of the site, faint, behind everything. */}
      <MarginArt home={homeKind(user)} />
      <AppBar user={user} counts={counts} photoId={photos.get(user.id) ?? null} />
      {children}
      <SiteFooter app />
      <Pulse counts={{ n: notifications, m: messages, r: connections }} />
      <TabBar counts={counts} />
    </>
  );
}
