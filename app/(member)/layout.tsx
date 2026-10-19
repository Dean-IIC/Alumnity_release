import type { ReactNode } from "react";
import { AppBar, TabBar } from "../../components/app/app-bar";
import { Pulse } from "../../components/app/pulse";
import { WelcomeBack } from "../../components/app/welcome-back";
import { SiteFooter } from "../../components/site-footer";
import { firstName } from "../../lib/format";
import { photoIdsOf } from "../../lib/server/profile";
import { currentUser } from "../../lib/server/session";
import { unreadMessages, unreadNotifications, waitingRequests } from "../../lib/server/social";
import "../styles/wire.css";
import "../styles/social.css";
import "../styles/app-bar.css";
// For the "Welcome back" greeting shown once after logging in.
import "../styles/join-scan.css";

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
      <AppBar user={user} counts={counts} photoId={photos.get(user.id) ?? null} />
      {children}
      <SiteFooter app />
      <Pulse counts={{ n: notifications, m: messages, r: connections }} />
      {/* Right after logging in only (the log-in form leaves a one-time flag): "Welcome back, <first name>." */}
      <WelcomeBack name={firstName(user.name)} />
      <TabBar counts={counts} />
    </>
  );
}
