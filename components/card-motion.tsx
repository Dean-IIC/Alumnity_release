"use client";

import { useEffect } from "react";

/** The cards that rise into place as they're reached (see app/styles/colour.css). */
const CARDS = ".sheet, .wf-card, .event-card, .person-card, .request-card, .album-card, .lp-card, .lp-stat, .focus__person";
/** The cards whose pattern spreads from where the pointer enters. */
const PATTERNED = "a.lp-card, .lp-stat, .event-card, .focus__person, .lp-leader, .more-card--memory, .person-card, .request-card, .side-box, .wf-card";

/**
 * Two small motions for every card on the site, set up once for all pages:
 * - each card rises into place as it scrolls into view, and settles back out when it leaves
 *   (so it rises again on the way back); cards added later (the endless feed, a page
 *   change) are picked up as they appear;
 * - where the pointer enters a card, its pattern starts spreading from that point.
 * Nothing moves for anyone who prefers less motion, and with no script every card simply shows.
 */
export function CardMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Where the pointer came in: the pattern's starting point.
    const enter = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.(PATTERNED) as HTMLElement | null;
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${Math.round(event.clientX - box.left)}px`);
      card.style.setProperty("--my", `${Math.round(event.clientY - box.top)}px`);
    };
    document.addEventListener("pointerover", enter, { passive: true });
    if (reduced) return () => document.removeEventListener("pointerover", enter);

    const watch = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle("is-shown", e.isIntersecting)), { threshold: 0.08 });
    const observe = (root: ParentNode) => root.querySelectorAll(CARDS).forEach((el) => watch.observe(el));
    observe(document);
    document.documentElement.classList.add("cards-ready");
    // New cards (more of the feed, another page): watched as they arrive.
    const added = new MutationObserver((changes) => {
      for (const change of changes)
        change.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(CARDS)) watch.observe(node);
          observe(node);
        });
    });
    added.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("pointerover", enter);
      watch.disconnect();
      added.disconnect();
      document.documentElement.classList.remove("cards-ready");
    };
  }, []);
  return null;
}
