/* The intro's hand-drawn leaf, and where it sits along the vine: x, y, angle. */
const LEAF = "M0 0c18 -22 52 -24 70 -6c-20 20 -52 22 -70 6zM0 0l58 -8";
const LEAVES: [number, number, number][] = [
  [70, 36, -28],
  [150, 52, 24],
  [236, 30, -18],
  [318, 46, 30]
];

/**
 * A vine of leaves, faint, like the page margins: behind an album's name on its card, and
 * behind a photo's name. It grows in from the right, clear of the words (see gallery.css).
 */
export function LeafVine({ className }: { className: string }) {
  return (
    <svg className={`leaf-vine ${className}`} viewBox="0 0 400 80" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <path className="leaf-vine__stem" d="M-10 54C50 22 96 70 160 46S270 14 330 40S390 58 410 36" />
      {LEAVES.map(([x, y, angle]) => (
        <path className="leaf-vine__leaf" d={LEAF} key={x} transform={`translate(${x} ${y}) rotate(${angle}) scale(0.62)`} />
      ))}
      <circle className="leaf-vine__dot" cx="112" cy="24" r="2.5" />
      <circle className="leaf-vine__dot" cx="282" cy="62" r="2" />
    </svg>
  );
}
