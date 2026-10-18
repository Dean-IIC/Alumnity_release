"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const openMenus = () => [...document.querySelectorAll<HTMLDetailsElement>("details.app-menu[open]")];

/**
 * The bar's menus (plain <details>) close on a tap outside them, on Escape, when another
 * opens, and when the page changes: a link in a menu swaps the page without reloading it,
 * and the menu stayed open over the new page (seen on a phone: More → Your batch).
 */
export function MenuCloser() {
  const path = usePathname();
  useEffect(() => {
    for (const m of openMenus()) m.open = false;
  }, [path]);
  useEffect(() => {
    const outside = (event: Event) => {
      for (const m of openMenus()) if (!m.contains(event.target as Node)) m.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const m of openMenus()) {
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
