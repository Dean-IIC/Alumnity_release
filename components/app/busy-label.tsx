import type { ReactNode } from "react";

/**
 * A button's words that change the moment it's pressed ("Connect" → "Requested"), so the
 * tap answers at once while the server catches up. Goes inside an ActionForm's button: the
 * form is marked busy while it sends, and CSS (app/styles/wire.css) shows the other words.
 *
 * Plain markup on purpose, not a client component: "More from HKBK" is added to Home by a
 * server action, and a client component first met there wasn't loaded in the browser, so
 * the cards failed to draw (and took Home down with them).
 */
export function BusyLabel({ idle, busy }: { idle: ReactNode; busy: ReactNode }) {
  return (
    <>
      <span className="busy-label__idle">{idle}</span>
      <span className="busy-label__busy">{busy}</span>
    </>
  );
}
