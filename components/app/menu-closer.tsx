"use client";

import { useEffect } from "react";

/** The bar's menus (plain <details>) close on a tap outside them, on Escape, and when another opens. */
export function MenuCloser() {
  useEffect(() => {
    const menus = () => [...document.querySelectorAll<HTMLDetailsElement>("details.app-menu[open]")];
    const outside = (event: Event) => {
      for (const m of menus()) if (!m.contains(event.target as Node)) m.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const m of menus()) {
        m.open = false;
        m.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return null;
}
