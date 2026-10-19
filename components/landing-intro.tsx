"use client";

import { GrowingCampusIntro } from "./growing-campus-intro";

/** The landing's intro: when it's done, the page is marked so the header's lockup shows. */
export function LandingIntro() {
  return <GrowingCampusIntro onComplete={() => document.querySelector(".landing")?.classList.add("landing--intro-complete")} />;
}
