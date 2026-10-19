import type { HTMLAttributes } from "react";

/**
 * The lockup: the college's crest, "Alumnity" (our name, with its gold dot) and the
 * college's full name under it. The college's logo and name stand with ours, as large as
 * the bar allows, the way the college asked; never "by HKBK CE".
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
        <span className="brand__name">
          Alumnity<span className="brand__dot">.</span>
        </span>
        <span className="brand__sub">{byline === "short" ? COLLEGE_NAME : `${COLLEGE_NAME} · ${NETWORK_NAME}`}</span>
      </span>
    </span>
  );
}
