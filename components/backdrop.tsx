"use client";

import { usePathname } from "next/navigation";
import { memo, type ReactNode } from "react";

/*
 * Each part of the site has its own background: a drawn motif in one of the college's
 * colours, over a soft wash of that colour, across the top of the page and fading out
 * before the content. Classy (thin lines, low contrast, one colour per page) and still
 * colourful across the site. Drawn here in SVG from a fixed seed: no image files, the same
 * picture every visit.
 *
 *   Home          "Dot grid"        navy and gold
 *   People        "Constellation"   teal: people as points, joined
 *   Your batch    "Year rings"      gold: a ring for every batch, like a tree's
 *   Groups        "Circles"         violet: circles that overlap
 *   Messages      "Currents"        blue: flowing lines
 *   Notifications "Signal"          amber: arcs going out
 *   Events        "Calendar"        rose: squares, some filled
 *   HKBK board    "Rising"          green: a chart going up
 *   Ask a senior  "Rays"            teal: light from a point
 *   Profiles      "Contours"        blue: a journey's lines
 *   Gallery       "Frames"          rose: photos laid down
 *   Causes        "Petals"          rose
 *   Everything else (joining, about, …) "Blueprint"  navy
 */

type Motif = "dots" | "constellation" | "rings" | "circles" | "currents" | "signal" | "calendar" | "rising" | "rays" | "contours" | "frames" | "petals" | "blueprint";
type Tone = "blue" | "teal" | "gold" | "violet" | "amber" | "rose" | "green";

const ROUTES: [prefix: string, motif: Motif, tone: Tone][] = [
  ["/home", "dots", "blue"],
  ["/notes", "dots", "blue"],
  ["/people", "constellation", "teal"],
  ["/connections", "constellation", "teal"],
  ["/batch", "rings", "gold"],
  ["/groups", "circles", "violet"],
  ["/messages", "currents", "blue"],
  ["/notifications", "signal", "amber"],
  ["/events", "calendar", "rose"],
  ["/board", "rising", "green"],
  ["/openings", "rising", "green"],
  ["/ask", "rays", "teal"],
  ["/me", "contours", "blue"],
  ["/gallery", "frames", "rose"],
  ["/causes", "petals", "rose"],
  ["/settings", "blueprint", "blue"],
  ["/desk", "blueprint", "blue"],
  ["/admin", "blueprint", "blue"]
];

function pick(path: string): [Motif, Tone] | null {
  if (path === "/") return null; // the landing has its own hero
  for (const [prefix, motif, tone] of ROUTES) if (path === prefix || path.startsWith(`${prefix}/`)) return [motif, tone];
  return ["blueprint", "blue"];
}

/** A small seeded random: the same drawing on every visit. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const W = 1440;
const H = 520;
const r1 = (n: number) => Math.round(n * 10) / 10;

function draw(motif: Motif): ReactNode {
  const rand = seeded(motif.length * 7919 + motif.charCodeAt(0));
  switch (motif) {
    case "dots": {
      const out: ReactNode[] = [];
      for (let y = 24; y < H; y += 28)
        for (let x = 24; x < W; x += 28) {
          const d = Math.hypot(x - W * 0.82, y - 60) / 700;
          if (d > 1) continue;
          const accent = rand() < 0.035;
          out.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={accent ? 3.2 : r1(2.2 - d * 1.4)} className={accent ? "bd-accent" : "bd-ink"} opacity={accent ? 0.9 : r1(0.55 - d * 0.45)} />);
        }
      return out;
    }
    case "constellation": {
      const pts = Array.from({ length: 34 }, () => [r1(W * 0.45 + rand() * W * 0.55), r1(rand() * H * 0.9)] as const);
      const lines: ReactNode[] = [];
      pts.forEach(([x, y], i) =>
        pts.slice(i + 1).forEach(([x2, y2], j) => {
          if (Math.hypot(x - x2, y - y2) < 170) lines.push(<line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} className="bd-line" />);
        })
      );
      return [
        ...lines,
        ...pts.map(([x, y], i) => <circle key={`p${i}`} cx={x} cy={y} r={i % 7 === 0 ? 6 : 3.5} className={i % 7 === 0 ? "bd-accent" : "bd-ink"} />)
      ];
    }
    case "rings":
      return Array.from({ length: 26 }, (_, i) => (
        <circle key={i} cx={W * 0.9} cy={-40} r={60 + i * 22 + (i % 3) * 4} className={i % 5 === 4 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 5 === 4 ? 2.2 : 1.1} />
      ));
    case "circles":
      return Array.from({ length: 9 }, (_, i) => {
        const r = 70 + rand() * 120;
        return <circle key={i} cx={r1(W * 0.5 + rand() * W * 0.5)} cy={r1(rand() * H * 0.7)} r={r1(r)} className={i % 3 === 0 ? "bd-fill" : "bd-line"} strokeWidth={1.4} />;
      });
    case "currents":
      return Array.from({ length: 14 }, (_, i) => {
        const y = 30 + i * 30;
        const a = 18 + (i % 4) * 6;
        return <path key={i} d={`M ${W * 0.3} ${y} C ${W * 0.5} ${y - a}, ${W * 0.62} ${y + a * 2}, ${W * 0.8} ${y + a} S ${W * 1.02} ${y - a}, ${W + 20} ${y}`} className={i === 4 || i === 9 ? "bd-accent-line" : "bd-line"} strokeWidth={i === 4 || i === 9 ? 2 : 1.2} />;
      });
    case "signal":
      return [
        ...Array.from({ length: 12 }, (_, i) => <circle key={i} cx={W * 0.86} cy={90} r={30 + i * 34} className={i % 4 === 1 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 4 === 1 ? 2.4 : 1.2} strokeDasharray={i % 2 ? "2 9" : undefined} />),
        <circle key="c" cx={W * 0.86} cy={90} r={9} className="bd-accent" />
      ];
    case "calendar": {
      const out: ReactNode[] = [];
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 22; col++) {
          const x = W * 0.42 + col * 36;
          const y = 26 + row * 36;
          if (x > W - 10) continue;
          const v = rand();
          out.push(<rect key={`${row}-${col}`} x={x} y={y} width={26} height={26} rx={6} className={v < 0.1 ? "bd-accent" : v < 0.38 ? "bd-fill-strong" : "bd-line"} strokeWidth={1} />);
        }
      return out;
    }
    case "rising": {
      const bars = Array.from({ length: 24 }, (_, i) => {
        const h = 40 + i * 9 + rand() * 60;
        return <rect key={i} x={W * 0.4 + i * 36} y={H - 70 - h} width={22} height={h} rx={4} className={i % 6 === 5 ? "bd-accent" : "bd-fill-strong"} />;
      });
      const line = Array.from({ length: 24 }, (_, i) => `${W * 0.4 + i * 36 + 11},${r1(H - 140 - i * 11 - Math.sin(i / 2) * 22)}`).join(" ");
      return [...bars, <polyline key="l" points={line} className="bd-accent-line" strokeWidth={2.4} />];
    }
    case "rays":
      return [
        ...Array.from({ length: 28 }, (_, i) => {
          const a = Math.PI * 0.52 + (i / 27) * Math.PI * 0.6;
          const len = 300 + (i % 3) * 110;
          return <line key={i} x1={W * 0.86} y1={-10} x2={r1(W * 0.86 + Math.cos(a) * len)} y2={r1(-10 + Math.sin(a) * len)} className={i % 5 === 2 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 5 === 2 ? 2 : 1.1} />;
        }),
        ...Array.from({ length: 18 }, (_, i) => <circle key={`d${i}`} cx={r1(W * 0.55 + rand() * W * 0.42)} cy={r1(rand() * H * 0.8)} r={2.6} className="bd-ink" />)
      ];
    case "contours":
      return Array.from({ length: 13 }, (_, i) => {
        const cx = W * 0.8;
        const cy = 120;
        const rx = 60 + i * 42;
        const ry = 34 + i * 26;
        const wob = (k: number) => r1((rand() - 0.5) * 18 * (1 + k / 6));
        return (
          <path
            key={i}
            d={`M ${cx - rx} ${cy} C ${cx - rx + wob(i)} ${cy - ry}, ${cx + rx + wob(i)} ${cy - ry + wob(i)}, ${cx + rx} ${cy} S ${cx - rx + wob(i)} ${cy + ry + wob(i)}, ${cx - rx} ${cy} Z`}
            className={i % 4 === 3 ? "bd-accent-line" : "bd-line"}
            strokeWidth={i % 4 === 3 ? 2 : 1.1}
          />
        );
      });
    case "frames":
      return Array.from({ length: 11 }, (_, i) => {
        const w = 110 + rand() * 90;
        const h = w * (0.66 + rand() * 0.2);
        const x = r1(W * 0.42 + rand() * W * 0.5);
        const y = r1(rand() * H * 0.6);
        return <rect key={i} x={x} y={y} width={r1(w)} height={r1(h)} rx={8} transform={`rotate(${r1((rand() - 0.5) * 16)} ${x + w / 2} ${y + h / 2})`} className={i % 4 === 0 ? "bd-fill-strong" : "bd-line"} strokeWidth={1.4} />;
      });
    case "petals":
      return Array.from({ length: 16 }, (_, i) => (
        <ellipse key={i} cx={W * 0.84} cy={90} rx={36} ry={150} transform={`rotate(${i * 22.5} ${W * 0.84} 90) translate(0 -110)`} className={i % 4 === 0 ? "bd-fill-strong" : "bd-line"} strokeWidth={1.2} />
      ));
    case "blueprint": {
      const out: ReactNode[] = [];
      for (let x = W * 0.4; x < W; x += 48) out.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} className="bd-grid" />);
      for (let y = 0; y < H; y += 48) out.push(<line key={`h${y}`} x1={W * 0.4} y1={y} x2={W} y2={y} className="bd-grid" />);
      out.push(<circle key="a" cx={W * 0.8} cy={140} r={150} className="bd-line" strokeWidth={1.4} />);
      out.push(<circle key="b" cx={W * 0.8} cy={140} r={96} className="bd-accent-line" strokeWidth={1.8} strokeDasharray="4 8" />);
      out.push(<line key="c" x1={W * 0.8 - 210} y1={140} x2={W * 0.8 + 210} y2={140} className="bd-line" />);
      out.push(<line key="d" x1={W * 0.8} y1={-70} x2={W * 0.8} y2={350} className="bd-line" />);
      return out;
    }
  }
}

const Drawing = memo(function Drawing({ motif }: { motif: Motif }) {
  return (
    <svg className="backdrop__art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMin slice" aria-hidden="true" focusable="false">
      {draw(motif)}
    </svg>
  );
});

/** The current page's background: the motif and its colour, chosen by where we are. */
export function Backdrop() {
  const chosen = pick(usePathname() ?? "/");
  if (!chosen) return null;
  const [motif, tone] = chosen;
  return (
    <div className={`backdrop backdrop--${tone}`} data-motif={motif} aria-hidden="true">
      <Drawing motif={motif} />
    </div>
  );
}
