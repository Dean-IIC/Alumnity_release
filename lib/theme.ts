/*
 * Light or dark: "system" (follow the device, the default), "light" or "dark", kept on this
 * device. THEME_SCRIPT runs in <head> before anything is drawn, so a dark page never
 * flashes light; it also follows the device if it switches while the page is open.
 */
export type ThemeChoice = "system" | "light" | "dark";
export const THEME_KEY = "alumnity-theme";

export const THEME_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_KEY)},m=matchMedia("(prefers-color-scheme: dark)");var apply=function(){var c=localStorage.getItem(k)||"system";document.documentElement.dataset.theme=c==="dark"||(c==="system"&&m.matches)?"dark":"light"};apply();if(m.addEventListener)m.addEventListener("change",apply);window.__alumnityTheme=apply}catch(e){}})();`;

/** Saves a choice on this device and applies it at once. */
export function chooseTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private browsing without storage: this page still changes.
  }
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
