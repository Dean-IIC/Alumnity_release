import type { ReactNode } from "react";
import MemberLayout from "../(member)/layout";

/** The gallery is for visitors and members alike: members keep the app's bar and tabs around it. */
export default function GalleryLayout({ children }: { children: ReactNode }) {
  return <MemberLayout>{children}</MemberLayout>;
}
