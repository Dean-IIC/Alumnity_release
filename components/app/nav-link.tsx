"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A link in the app's bars: marked as the current page when you're in its section (any
 * of `match`, or under its own address), and opened without reloading the page.
 */
export function NavLink({ match, ...props }: ComponentProps<typeof Link> & { match?: string[] }) {
  const path = usePathname() ?? "";
  const roots = match ?? [String(props.href)];
  const here = roots.some((r) => path === r || path.startsWith(`${r}/`));
  return <Link {...props} aria-current={here ? "page" : undefined} />;
}

/** The More and You menus: marked current when you're on one of their pages. */
export function MenuMark({ match, children, className }: { match: string[]; children: React.ReactNode; className?: string }) {
  const path = usePathname() ?? "";
  const here = match.some((r) => path === r || path.startsWith(`${r}/`));
  return (
    <summary className={className} aria-current={here ? "page" : undefined}>
      {children}
    </summary>
  );
}
