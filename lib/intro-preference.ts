/**
 * Whether a visitor wants the intro. Stored in the browser only. The intro offers
 * "Don't play the intro next time"; the footer can turn it back on or replay it.
 * `?intro=1` always plays it.
 */
const KEY = "alumnity:intro";

export type IntroPreference = "play" | "skip";

export function readIntroPreference(): IntroPreference {
  try {
    return window.localStorage.getItem(KEY) === "skip" ? "skip" : "play";
  } catch {
    return "play";
  }
}

export function writeIntroPreference(preference: IntroPreference) {
  try {
    if (preference === "skip") window.localStorage.setItem(KEY, "skip");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode or storage disabled: the intro just plays, which is the default.
  }
}

/** Should this page load play the intro? */
export function shouldPlayIntro(): boolean {
  if (new URLSearchParams(window.location.search).get("intro") === "1") return true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return readIntroPreference() === "play";
}

/**
 * Runs in <head> before first paint: marks the page so CSS can hide the intro at once
 * for visitors who opted out, rather than flashing it until React catches up.
 */
export const INTRO_PREFERENCE_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get("intro")==="1";var m=matchMedia("(prefers-reduced-motion: reduce)").matches;if(!q&&(m||localStorage.getItem("${KEY}")==="skip"))document.documentElement.dataset.intro="skip"}catch(e){}})()`;
