import { useId, type HTMLAttributes } from "react";

/**
 * The Alumnity lockup: wordmark, red swoosh, and the college beneath. Sized entirely in
 * em, so the intro's big centred copy and the nav's small one are the same shape at two
 * sizes and the intro can float one exactly onto the other.
 *
 * Alumnity is for HKBK College of Engineering, not the wider HKBK group, so the byline
 * names the college: in full where there is room, "HKBK CE" in the nav. The intro's
 * copy carries both and crossfades from one to the other as it floats into the nav.
 */
export const SWOOSH_CENTRELINE = "M10 40C92 14 200 8 290 26S372 38 392 16";

export const COLLEGE_NAME = "HKBK College of Engineering";
export const COLLEGE_SHORT_NAME = "HKBK CE";

type BrandLockupProps = HTMLAttributes<HTMLSpanElement> & {
  "data-brand-target"?: boolean;
  byline?: "full" | "short" | "both";
};

export function BrandLockup({ byline = "short", ...props }: BrandLockupProps) {
  const maskId = useId();
  return (
    <span {...props} className={`brand ${props.className ?? ""}`}>
      <span className="brand__name">alumnity<span className="brand__dot">.</span></span>
      <svg className="brand__swoosh" viewBox="0 0 400 56" aria-hidden="true">
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="56">
          {/* The intro draws this stroke along the swoosh; settled, it is fully drawn. */}
          <path className="brand__swoosh-reveal" d={SWOOSH_CENTRELINE} pathLength={1} />
        </mask>
        <path
          className="brand__swoosh-ink"
          mask={`url(#${maskId})`}
          d="M8 43C90 12 200 3 292 21C340 30 372 29 395 12C374 36 338 41 289 32C200 17 94 22 8 43Z"
        />
      </svg>
      <span className="brand__by">
        {byline !== "short" && <span className="brand__by-full">by {COLLEGE_NAME}</span>}
        {byline !== "full" && <span className="brand__by-short">by {COLLEGE_SHORT_NAME}</span>}
      </span>
    </span>
  );
}
