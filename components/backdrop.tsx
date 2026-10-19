"use client";

import { usePathname } from "next/navigation";
import { memo, type ReactNode } from "react";
import "../app/styles/member-navy.css";
import { Scene, type SceneName } from "./scene";

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

function pick(path: string): [Motif, Tone, inside: boolean] | null {
  if (path === "/") return null; // the landing has its own hero
  for (const [prefix, motif, tone] of ROUTES) if (path === prefix || path.startsWith(`${prefix}/`)) return [motif, tone, true];
  return ["blueprint", "blue", false];
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
const H = 900;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Drawn over the whole screen: strongest in the margins (CSS fades it under the page's column). */
function draw(motif: Motif): ReactNode {
  const rand = seeded(motif.length * 7919 + motif.charCodeAt(0));
  switch (motif) {
    case "dots": {
      const out: ReactNode[] = [];
      for (let y = 20; y < H; y += 30)
        for (let x = 20; x < W; x += 30) {
          const accent = rand() < 0.03;
          out.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={accent ? 3.4 : 1.9} className={accent ? "bd-accent" : "bd-ink"} opacity={accent ? 0.9 : 0.42} />);
        }
      return out;
    }
    case "constellation": {
      const pts = Array.from({ length: 70 }, () => [r1(rand() * W), r1(rand() * H)] as const);
      const lines: ReactNode[] = [];
      pts.forEach(([x, y], i) =>
        pts.slice(i + 1).forEach(([x2, y2], j) => {
          if (Math.hypot(x - x2, y - y2) < 150) lines.push(<line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} className="bd-line" />);
        })
      );
      return [...lines, ...pts.map(([x, y], i) => <circle key={`p${i}`} cx={x} cy={y} r={i % 7 === 0 ? 6 : 3.5} className={i % 7 === 0 ? "bd-accent" : "bd-ink"} />)];
    }
    case "rings":
      return [
        ...Array.from({ length: 22 }, (_, i) => <circle key={`a${i}`} cx={W + 20} cy={-20} r={60 + i * 26} className={i % 5 === 4 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 5 === 4 ? 2.2 : 1.1} />),
        ...Array.from({ length: 16 }, (_, i) => <circle key={`b${i}`} cx={-30} cy={H + 30} r={60 + i * 26} className={i % 5 === 2 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 5 === 2 ? 2.2 : 1.1} />)
      ];
    case "circles":
      return Array.from({ length: 16 }, (_, i) => {
        const r = 60 + rand() * 120;
        return <circle key={i} cx={r1(rand() * W)} cy={r1(rand() * H)} r={r1(r)} className={i % 3 === 0 ? "bd-fill" : "bd-line"} strokeWidth={1.4} />;
      });
    case "currents":
      return Array.from({ length: 26 }, (_, i) => {
        const y = 20 + i * 34;
        const a = 18 + (i % 4) * 7;
        return <path key={i} d={`M -20 ${y} C ${W * 0.2} ${y - a}, ${W * 0.35} ${y + a * 2}, ${W * 0.5} ${y + a} S ${W * 0.8} ${y - a}, ${W + 20} ${y}`} className={i % 7 === 3 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 7 === 3 ? 2 : 1.1} />;
      });
    case "signal":
      return [
        ...Array.from({ length: 14 }, (_, i) => <circle key={`a${i}`} cx={W - 60} cy={80} r={30 + i * 40} className={i % 4 === 1 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 4 === 1 ? 2.4 : 1.2} strokeDasharray={i % 2 ? "2 9" : undefined} />),
        ...Array.from({ length: 9 }, (_, i) => <circle key={`b${i}`} cx={60} cy={H - 60} r={30 + i * 40} className={i % 4 === 2 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 4 === 2 ? 2.4 : 1.2} />),
        <circle key="c" cx={W - 60} cy={80} r={9} className="bd-accent" />
      ];
    case "calendar": {
      const out: ReactNode[] = [];
      for (let y = 18; y < H; y += 46)
        for (let x = 18; x < W; x += 46) {
          const v = rand();
          out.push(<rect key={`${x}-${y}`} x={x} y={y} width={30} height={30} rx={7} className={v < 0.07 ? "bd-accent" : v < 0.3 ? "bd-fill-strong" : "bd-line"} strokeWidth={1} />);
        }
      return out;
    }
    case "rising": {
      const n = 36;
      const step = W / n;
      const bars = Array.from({ length: n }, (_, i) => {
        const h = 60 + i * 12 + rand() * 90;
        return <rect key={i} x={r1(i * step + 6)} y={r1(H - h)} width={r1(step - 14)} height={r1(h)} rx={4} className={i % 7 === 6 ? "bd-accent" : "bd-fill-strong"} />;
      });
      const line = Array.from({ length: n }, (_, i) => `${r1(i * step + step / 2)},${r1(H - 160 - i * 14 - Math.sin(i / 2) * 26)}`).join(" ");
      return [...bars, <polyline key="l" points={line} className="bd-accent-line" strokeWidth={2.4} />];
    }
    case "rays": {
      const fan = (cx: number, cy: number, from: number, span: number, key: string) =>
        Array.from({ length: 26 }, (_, i) => {
          const a = from + (i / 25) * span;
          const len = 420 + (i % 3) * 160;
          return <line key={`${key}${i}`} x1={cx} y1={cy} x2={r1(cx + Math.cos(a) * len)} y2={r1(cy + Math.sin(a) * len)} className={i % 5 === 2 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 5 === 2 ? 2 : 1.1} />;
        });
      return [
        ...fan(W - 20, -10, Math.PI * 0.5, Math.PI * 0.5, "a"),
        ...fan(20, H + 10, -Math.PI * 0.5, Math.PI * 0.5, "b"),
        ...Array.from({ length: 30 }, (_, i) => <circle key={`d${i}`} cx={r1(rand() * W)} cy={r1(rand() * H)} r={2.6} className="bd-ink" />)
      ];
    }
    case "contours": {
      const ring = (cx: number, cy: number, n: number, key: string) =>
        Array.from({ length: n }, (_, i) => {
          const rx = 60 + i * 44;
          const ry = 34 + i * 28;
          const wob = () => r1((rand() - 0.5) * 22);
          return <path key={`${key}${i}`} d={`M ${cx - rx} ${cy} C ${cx - rx + wob()} ${cy - ry}, ${cx + rx + wob()} ${cy - ry + wob()}, ${cx + rx} ${cy} S ${cx - rx + wob()} ${cy + ry + wob()}, ${cx - rx} ${cy} Z`} className={i % 4 === 3 ? "bd-accent-line" : "bd-line"} strokeWidth={i % 4 === 3 ? 2 : 1.1} />;
        });
      return [...ring(W * 0.85, 140, 13, "a"), ...ring(W * 0.12, H - 120, 10, "b")];
    }
    case "frames":
      return Array.from({ length: 22 }, (_, i) => {
        const w = 100 + rand() * 90;
        const h = w * (0.66 + rand() * 0.2);
        const x = r1(rand() * (W - 100));
        const y = r1(rand() * (H - 80));
        return <rect key={i} x={x} y={y} width={r1(w)} height={r1(h)} rx={8} transform={`rotate(${r1((rand() - 0.5) * 16)} ${x + w / 2} ${y + h / 2})`} className={i % 4 === 0 ? "bd-fill-strong" : "bd-line"} strokeWidth={1.4} />;
      });
    case "petals": {
      const flower = (cx: number, cy: number, key: string) =>
        Array.from({ length: 16 }, (_, i) => (
          <ellipse key={`${key}${i}`} cx={cx} cy={cy} rx={36} ry={150} transform={`rotate(${i * 22.5} ${cx} ${cy}) translate(0 -110)`} className={i % 4 === 0 ? "bd-fill-strong" : "bd-line"} strokeWidth={1.2} />
        ));
      return [...flower(W - 120, 120, "a"), ...flower(140, H - 120, "b")];
    }
    case "blueprint": {
      const out: ReactNode[] = [];
      for (let x = 0; x < W; x += 48) out.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} className="bd-grid" />);
      for (let y = 0; y < H; y += 48) out.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} className="bd-grid" />);
      for (const [cx, cy, k] of [[W - 200, 160, "a"], [200, H - 160, "b"]] as const) {
        out.push(<circle key={`${k}1`} cx={cx} cy={cy} r={150} className="bd-line" strokeWidth={1.4} />);
        out.push(<circle key={`${k}2`} cx={cx} cy={cy} r={96} className="bd-accent-line" strokeWidth={1.8} strokeDasharray="4 8" />);
        out.push(<line key={`${k}3`} x1={cx - 210} y1={cy} x2={cx + 210} y2={cy} className="bd-line" />);
        out.push(<line key={`${k}4`} x1={cx} y1={cy - 210} x2={cx} y2={cy + 210} className="bd-line" />);
      }
      return out;
    }
  }
}

const Drawing = memo(function Drawing({ motif }: { motif: Motif }) {
  return (
    <svg className="backdrop__art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {draw(motif)}
    </svg>
  );
});

/** The current page's background: the motif and its colour, chosen by where we are. */
/** Each part of the signed-in site's picture (components/scene.tsx). */
const SCENE_FOR: [prefix: string, scene: SceneName][] = [
  ["/home", "home"],
  ["/notes", "home"],
  ["/people", "people"],
  ["/connections", "connections"],
  ["/batch", "batch"],
  ["/groups", "groups"],
  ["/messages", "messages"],
  ["/notifications", "notifications"],
  ["/events", "events"],
  ["/board", "board"],
  ["/openings", "board"],
  ["/ask", "ask"],
  ["/me", "profile"],
  ["/gallery", "gallery"],
  ["/causes", "causes"]
];

const sceneFor = (path: string): SceneName => SCENE_FOR.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? "steady";

/** The current page's background: the motif and its colour, chosen by where we are. */
export function Backdrop() {
  const path = usePathname() ?? "/";
  const chosen = pick(path);
  if (!chosen) return null;
  const [motif, tone, inside] = chosen;
  // Inside the site, each page stands on its own flat blue picture of waves, spheres and
  // pills (components/scene.tsx), so signing in doesn't feel like another site.
  if (inside)
    return (
      <div className="backdrop backdrop--navy" aria-hidden="true">
        <Scene name={sceneFor(path)} />
      </div>
    );
  return (
    <div className={`backdrop backdrop--${tone}`} data-motif={motif} aria-hidden="true">
      <Drawing motif={motif} />
    </div>
  );
}
