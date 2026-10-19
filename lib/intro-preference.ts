/**
 * Whether a visitor wants the intro. Stored in the browser only. The intro offers
 * "Don't play the intro next time"; the footer can turn it back on or replay it.
 * `?intro=1` always plays it.
 */
const KEY = "alumnity:intro";
/** The same choice as a cookie, so the server knows to send a signed-in member straight Home. */
export const INTRO_COOKIE = "alumnity_intro";

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
  try {
    document.cookie = preference === "skip" ? `${INTRO_COOKIE}=skip; path=/; max-age=31536000; samesite=lax` : `${INTRO_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // Private mode or storage disabled: the intro just plays, which is the default.
  }
}

/** Should this page load play the intro? */
export function shouldPlayIntro(): boolean {
  // Skipped already: opted out (set in <head>), or "Skip intro" pressed before the page's
  // scripts had loaded (the <head> script handles that press too).
  if (document.documentElement.dataset.intro === "skip") return false;
  if (new URLSearchParams(window.location.search).get("intro") === "1") return true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return readIntroPreference() === "play";
}

/**
 * Runs in <head> before first paint: marks the page so CSS can hide the intro at once
 * for visitors who opted out, rather than flashing it until React catches up. It also
 * makes "Skip intro" work from the very first moment: on a slow connection the button is
 * on screen seconds before the page's scripts arrive, and a press then would do nothing.
 * Marking the page hides the intro (in CSS) and tells the intro, once it loads, not to play.
 */
export const INTRO_PREFERENCE_SCRIPT = `(function(){var d=document.documentElement;try{var q=new URLSearchParams(location.search).get("intro")==="1";var m=matchMedia("(prefers-reduced-motion: reduce)").matches;if(!q&&(m||localStorage.getItem("${KEY}")==="skip"))d.dataset.intro="skip"}catch(e){}document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest(".ink-intro__skip"))d.dataset.intro="skip"},true)})()`;
