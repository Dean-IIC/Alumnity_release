import type { ReactNode } from "react";
import MemberLayout from "../(member)/layout";

/** News & videos is for visitors and members alike, as the gallery is: members keep the app's bar and tabs around it. */
export default function NewsLayout({ children }: { children: ReactNode }) {
  return <MemberLayout>{children}</MemberLayout>;
}
