import type { HTMLAttributes } from "react";

/**
 * The lockup, as the college's own site has it: the HKBK crest, the college's name in
 * bold, and "Alumni Network" under it. This is the college's alumni network (a subdomain of
 * hkbkce.in), so it carries the college's name and logo, not a brand of its own.
 */
export const COLLEGE_NAME = "HKBK College of Engineering";
export const COLLEGE_SHORT_NAME = "HKBK";
export const NETWORK_NAME = "Alumni Network";
/** The college's standard logo, from hkbkce.in (256 px). */
export const LOGO = "/college/hkbk-logo.png";

type BrandLockupProps = HTMLAttributes<HTMLSpanElement> & {
  "data-brand-target"?: boolean;
  /** "full" adds the college's place under the name, where there's room (the landing page). */
  byline?: "full" | "short" | "both";
};

export function BrandLockup({ byline = "short", ...props }: BrandLockupProps) {
  return (
    <span {...props} className={`brand ${props.className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand__logo" src={LOGO} alt="" width={256} height={256} />
      <span className="brand__text">
        <span className="brand__name">{COLLEGE_NAME}</span>
        <span className="brand__sub">{byline === "short" ? NETWORK_NAME : `${NETWORK_NAME} · Nagawara, Bengaluru`}</span>
      </span>
    </span>
  );
}
