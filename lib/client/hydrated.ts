"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the page's script has taken over (false in the server's HTML and on the first
 * render, true after). A form handled in the browser keeps its button disabled until then:
 * tapped early, on a slow phone, the browser would send the form itself and only reload the
 * page (nothing saved, nothing said).
 */
export const useHydrated = () =>
  useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
