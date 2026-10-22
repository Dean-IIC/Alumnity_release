/**
 * Whether a visitor wants the intro. Stored in the browser only. The intro offers
 * "Don't play the intro next time"; the footer can turn it back on or replay it.
 * `?intro=1` always plays it.
 */
const KEY = "alumnity:intro";
/** Set (for this tab) once the intro has played: going back to Home doesn't play it again. */
const PLAYED = "alumnity:intro-played";
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

type IntroWindow = Window & { __alumnityLoadPath?: string; __alumnityIntro?: { path: string; play: boolean } };

/**
 * Should this page load play the intro? Only when Home is opened afresh in a tab (the first
 * visit) or reloaded: not when coming back to it with Back, a link or the logo (it played
 * every time, a visitor found), nor when it already played in this tab. "Play the intro"
 * (?intro=1) always plays it. Decided once per page, so React running its effects twice
 * (in development) asks the same question and gets the same answer.
 */
export function shouldPlayIntro(): boolean {
  const w = window as IntroWindow;
  if (w.__alumnityIntro?.path === location.pathname + location.search) return w.__alumnityIntro.play;
  const play = decide(w);
  w.__alumnityIntro = { path: location.pathname + location.search, play };
  if (play) {
    try {
      sessionStorage.setItem(PLAYED, "1");
    } catch {
      // Storage off: it just plays as before.
    }
  } else document.documentElement.dataset.intro = "skip";
  return play;
}

function decide(w: IntroWindow): boolean {
  // Skipped already: opted out (set in <head>), or "Skip intro" pressed before the page's
  // scripts had loaded (the <head> script handles that press too).
  if (document.documentElement.dataset.intro === "skip") return false;
  if (new URLSearchParams(location.search).get("intro") === "1") return true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (readIntroPreference() !== "play") return false;
  // Arrived by a link inside the site (the page wasn't loaded here): never.
  if (w.__alumnityLoadPath !== undefined && w.__alumnityLoadPath !== location.pathname) return false;
  const nav = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
  if (nav === "reload") return true;
  if (nav === "back_forward") return false;
  try {
    return sessionStorage.getItem(PLAYED) !== "1";
  } catch {
    return true;
  }
}

/**
 * Runs in <head> before first paint: marks the page so CSS can hide the intro at once
 * for visitors who opted out, rather than flashing it until React catches up. It also
 * makes "Skip intro" work from the very first moment: on a slow connection the button is
 * on screen seconds before the page's scripts arrive, and a press then would do nothing.
 * Marking the page hides the intro (in CSS) and tells the intro, once it loads, not to play.
 */
export const INTRO_PREFERENCE_SCRIPT = `(function(){var d=document.documentElement;window.__alumnityLoadPath=location.pathname;try{var q=new URLSearchParams(location.search).get("intro")==="1";var m=matchMedia("(prefers-reduced-motion: reduce)").matches;var n=(performance.getEntriesByType("navigation")[0]||{}).type;var again=n==="back_forward"||(n!=="reload"&&sessionStorage.getItem("${PLAYED}")==="1");if(!q&&(m||again||localStorage.getItem("${KEY}")==="skip"))d.dataset.intro="skip"}catch(e){}document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest(".ink-intro__skip"))d.dataset.intro="skip"},true)})()`;
