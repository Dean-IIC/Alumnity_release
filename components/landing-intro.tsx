"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readIntroPreference, writeIntroPreference } from "../lib/intro-preference";
import { GrowingCampusIntro } from "./growing-campus-intro";

/**
 * The landing's intro: when it's done, the page is marked so the header's lockup shows. A
 * signed-in member (`then`) goes on to their Home once it's over or skipped.
 */
export function LandingIntro({ then }: { then?: string }) {
  const router = useRouter();
  // The choice was kept in this browser before it was also a cookie: copy it across, so
  // the server sends a member who opted out straight Home next time.
  useEffect(() => writeIntroPreference(readIntroPreference()), []);
  return (
    <GrowingCampusIntro
      onComplete={() => {
        document.querySelector(".landing")?.classList.add("landing--intro-complete");
        if (then) router.replace(then);
      }}
    />
  );
}
