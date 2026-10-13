# Growing Campus Ink Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic aerial-map intro with a paper-and-ink A/CSE-to-D campus-growth animation that resolves into the Alumnity welcome.

**Architecture:** `lib/campus.ts` owns five physically ordered campus blocks and their local artwork/photo paths. A focused `GrowingCampusIntro` client component owns only settled/skip state and renders static SVG/CSS animation layers; `CampusLanding` composes that intro with the settled welcome. CSS performs the predetermined ink drop, route, foliage, and block stagger with no runtime animation loop.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS keyframes, local raster/SVG assets, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-growing-campus-ink-intro-design.md`

## Global Constraints

- Route order is exactly `a-cse`, `admin`, `b`, `c`, `d`; the animation begins at A/CSE and ends at D.
- Use only warm paper white (`#F8F4EA`), sepia ink (`#3A2921`), muted leaf wash (`#6E7B52`) in the illustration; no blue aerial map, dashboard cards, pins, or generic building geometry.
- Store every new local media asset under `public/assets/campus/growing-intro/`; do not serve the video or any source image from Downloads.
- Use CSS `opacity`, `transform`, `stroke-dashoffset`, and a masked/clip reveal only. Motion timing follows the spec and `prefers-reduced-motion` removes spatial travel.
- The animation is first-visit explanatory motion, must offer a keyboard-accessible skip action after the ink drop, and settle in the D-block welcome state.
- Keep the final welcome copy and two actions unchanged.

---

### Task 1: Model the A-to-D physical route

**Files:**
- Modify: `lib/campus.ts`
- Modify: `tests/campus.test.ts`

**Interfaces:**
- Produces: `CampusBlockId`, `CampusBlock`, `CAMPUS_BLOCKS`, `FINAL_BLOCK_ID`, `findCampusBlock(id)`.
- Consumes: the user-provided physical order `A/CSE → Admin → B → C → D` from the spec.

- [ ] **Step 1: Write the failing route-model test**

Replace the four-marker expectation with:

```ts
import { CAMPUS_BLOCKS, FINAL_BLOCK_ID, findCampusBlock } from "../lib/campus";

it("keeps the physical HKBK route from A/CSE to D", () => {
  expect(CAMPUS_BLOCKS.map((block) => block.id)).toEqual([
    "a-cse", "admin", "b", "c", "d"
  ]);
  expect(FINAL_BLOCK_ID).toBe("d");
  expect(CAMPUS_BLOCKS.every((block) =>
    block.illustration.startsWith("/assets/campus/growing-intro/")
  )).toBe(true);
  expect(findCampusBlock("d")?.label).toBe("D block");
  expect(findCampusBlock("unknown")).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/campus.test.ts`

Expected: FAIL because `CAMPUS_BLOCKS` and `FINAL_BLOCK_ID` do not exist.

- [ ] **Step 3: Replace marker data with ordered block data**

Define the public types and model in `lib/campus.ts`:

```ts
export type CampusBlockId = "a-cse" | "admin" | "b" | "c" | "d";

export type CampusBlock = {
  id: CampusBlockId;
  label: string;
  illustration: string;
  x: number;
  y: number;
};

export const FINAL_BLOCK_ID: CampusBlockId = "d";
export const D_BLOCK_REAL_IMAGE = "/assets/campus/growing-intro/d-block-real.jpg";
export const CAMPUS_BLOCKS: CampusBlock[] = [
  { id: "a-cse", label: "A block · CSE", illustration: "/assets/campus/growing-intro/a-cse-ink.png", x: 82, y: 34 },
  { id: "admin", label: "Admin block", illustration: "/assets/campus/growing-intro/admin-ink.png", x: 66, y: 47 },
  { id: "b", label: "B block", illustration: "/assets/campus/growing-intro/b-ink.png", x: 49, y: 54 },
  { id: "c", label: "C block", illustration: "/assets/campus/growing-intro/c-ink.png", x: 31, y: 63 },
  { id: "d", label: "D block", illustration: "/assets/campus/growing-intro/d-ink.png", x: 14, y: 72 }
];
export function findCampusBlock(id: string): CampusBlock | undefined {
  return CAMPUS_BLOCKS.find((block) => block.id === id);
}
```

Use the local `growing-intro` paths and x-values that descend from roughly 83% at A/CSE to 12% at D; use modest y offsets so the route looks like a planted campus edge rather than a ruler-straight timeline.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `npm run test -- tests/campus.test.ts; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the route model**

```bash
git add lib/campus.ts tests/campus.test.ts
git commit -m "feat: model HKBK blocks from A to D"
```

### Task 2: Stage the five local ink illustrations

**Files:**
- Create: `public/assets/campus/growing-intro/a-cse-ink.png`
- Create: `public/assets/campus/growing-intro/admin-ink.png`
- Create: `public/assets/campus/growing-intro/b-ink.png`
- Create: `public/assets/campus/growing-intro/c-ink.png`
- Create: `public/assets/campus/growing-intro/d-ink.png`
- Create: `public/assets/campus/growing-intro/d-block-real.jpg`
- Modify: `lib/campus.ts`

**Interfaces:**
- Consumes: `CampusBlock.illustration` paths from Task 1 and the user-provided drone/video/sketch references.
- Produces: five transparent ink illustrations and the D-block final real-photo asset used by Tasks 3–4.

- [ ] **Step 1: Inspect the existing local HKBK references**

Inspect the existing `public/assets/campus` images and the supplied drone-video contact sheet. Select the A/CSE facade as the first building reference and the best D-side campus frame/photo as the final real reference. Do not move, rename, delete, or modify the user’s original Downloads video.

- [ ] **Step 2: Create individual art assets, not one composited atlas**

Generate or art-direct each PNG as a transparent, single-building pen-and-wash illustration: sepia ink facade, uneven hand-drawn line weight, small leaf cluster at the base, no typography, no UI, no coloured sky, and no extra campus buildings. The five assets must have visibly different widths/heights so the A-to-D spine feels built from separate buildings.

- [ ] **Step 3: Copy generated/frozen media into the public asset directory**

Place the exact files at the six paths listed above. Use the final D reference image as `d-block-real.jpg`. Confirm their dimensions and file sizes with `Get-Item` before proceeding.

- [ ] **Step 4: Wire exact illustration paths into the route model**

Set each `CampusBlock.illustration` field to its matching relative public path. Keep `d-block-real.jpg` as a named constant for the final hero/photo frame.

- [ ] **Step 5: Commit the frozen art assets**

```bash
git add public/assets/campus/growing-intro lib/campus.ts
git commit -m "feat: add individual HKBK ink building art"
```

### Task 3: Build the stateful paper-and-ink intro component

**Files:**
- Create: `components/growing-campus-intro.tsx`
- Modify: `components/campus-landing.tsx`
- Modify: `tests/campus.test.ts`

**Interfaces:**
- Consumes: `CAMPUS_BLOCKS`, `FINAL_BLOCK_ID`, `D_BLOCK_REAL_IMAGE`, and `WELCOME_COPY` from `lib/campus.ts`.
- Produces: `GrowingCampusIntro` with `onComplete(): void`; it reports a settled state after the sequence or skip.

- [ ] **Step 1: Write the failing component-structure test**

Add a source-level test that reads `components/growing-campus-intro.tsx` and asserts it contains the five `data-block` values in physical order, a `Skip intro` button, and a `prefers-reduced-motion` branch. Keep assertions narrow enough to permit later styling changes.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/campus.test.ts`

Expected: FAIL because the new component file is absent.

- [ ] **Step 3: Implement the component with stable state transitions**

Use a minimal client component:

```tsx
type GrowingCampusIntroProps = { onComplete: () => void };

export function GrowingCampusIntro({ onComplete }: GrowingCampusIntroProps) {
  const [isSettled, setIsSettled] = useState(false);
  const settle = useCallback(() => { setIsSettled(true); onComplete(); }, [onComplete]);
  // reduced motion settles immediately; a single 8-second timer settles the normal sequence
  // render paper, drop, shared route, then one <figure data-block={block.id}> per CAMPUS_BLOCKS
}
```

Render a semantic `<section aria-label="A growing illustration of the HKBK campus">`,
an `aria-hidden` art layer, and a button labelled `Skip intro`. The render order must
map exactly over `CAMPUS_BLOCKS`; no clickable building pins survive from the old scene.

- [ ] **Step 4: Compose the component into `CampusLanding`**

Remove old `selectedId`, `revealStop`, idle timer, aerial atlas, route markers, and
`sky-wash`. Let `CampusLanding` track only whether `GrowingCampusIntro` has settled.
Show the existing welcome hero after completion with the D-block real image, keeping its
heading and two actions. Pass `onComplete={() => setIntroComplete(true)}` to the intro.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run test; npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the component structure**

```bash
git add components/growing-campus-intro.tsx components/campus-landing.tsx tests/campus.test.ts
git commit -m "feat: add growing HKBK ink intro"
```

### Task 4: Implement the illustration choreography and welcome handoff

**Files:**
- Modify: `app/globals.css`
- Modify: `components/growing-campus-intro.tsx`

**Interfaces:**
- Consumes: `.ink-intro`, `.ink-drop`, `.ink-route`, and `.ink-block--{id}` markup from Task 3.
- Produces: responsive, reduced-motion-safe CSS animation and the settled D-photo welcome.

- [ ] **Step 1: Add explicit motion tokens**

Add shared CSS custom properties:

```css
.landing {
  --paper: #f8f4ea;
  --ink: #3a2921;
  --leaf: #6e7b52;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-ink: cubic-bezier(0.77, 0, 0.175, 1);
}
```

Keep the page background paper-like and remove the current blue sky gradient, atlas
slices, marker-card rules, and golden map route rules.

- [ ] **Step 2: Animate the drop and root route**

Use a single ink-drop element with an entry transform from above the A/CSE end, opacity,
and no bounce. Draw the shared SVG route right-to-left using `stroke-dashoffset` over
about 5.6 seconds beginning when the drop lands. Position it behind the blocks and use
dark-brown stroke only.

- [ ] **Step 3: Stagger each building as a leaf-then-illustration event**

For each `data-block`, set a `--delay` based on its route index. Reveal its foliage with
opacity/scale `0.95 → 1`, then reveal its transparent building asset with opacity and a
small `translateY(10px) → 0` entry. Do not animate widths, heights, top, or left. Each
illustration stays in its final position while later stops grow.

- [ ] **Step 4: Build the calm final handoff**

When `.landing--intro-complete` is present, fade the ink stage to a quiet low-opacity
backdrop and bring in the existing welcome content plus D-block photo using opacity and
`clip-path`. The welcome copy remains readable over warm paper; its actions retain
keyboard focus styling.

- [ ] **Step 5: Add mobile and reduced-motion rules**

At `max-width: 760px`, stack the A-to-D route vertically while preserving order and
keeping each art figure in frame. Under `prefers-reduced-motion: reduce`, hide the drop
and route animation, show a low-opacity static five-block line art backdrop, and make
the D-block welcome visible immediately.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm run test; npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the choreography**

```bash
git add app/globals.css components/growing-campus-intro.tsx
git commit -m "feat: animate HKBK campus from A to D"
```

### Task 5: Verify the lived sequence in the browser

**Files:**
- Modify: `docs/2026-10-13-animated-landing-design.md`

**Interfaces:**
- Consumes: completed intro from Tasks 1–4.
- Produces: final validation notes and an updated design document without references to the retired atlas approach.

- [ ] **Step 1: Start the local application**

Run: `npm run dev -- -p 3004`

Expected: the landing is reachable at `http://localhost:3004`.

- [ ] **Step 2: Inspect the sequence at six checkpoints**

Capture and review: blank paper; drop landing at A/CSE; A/CSE drawing; middle B drawing;
D drawing; settled D-block welcome. Confirm the route never makes a courtyard shape or
travels left-to-right.

- [ ] **Step 3: Verify controls and responsive behavior**

Activate “Skip intro” by keyboard and confirm it reaches the settled D welcome. Repeat
at mobile width and under reduced motion; no action may be blocked by the animation.

- [ ] **Step 4: Update design notes with final asset/source mapping**

Replace obsolete aerial-atlas notes in `docs/2026-10-13-animated-landing-design.md`
with the final route order, named `growing-intro` asset directory, 8-second sequence,
and reduced-motion behavior.

- [ ] **Step 5: Run the final checks**

Run: `npm run test; npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit verification documentation**

```bash
git add docs/2026-10-13-animated-landing-design.md
git commit -m "docs: record A to D ink intro verification"
```

## Plan self-review

- **Spec coverage:** Task 1 fixes the physical order; Task 2 freezes local individual art; Task 3 removes map interaction and provides skip state; Task 4 implements the colour, timing, route, final handoff, mobile, and reduced-motion requirements; Task 5 verifies the seven promised states and updates the old design notes.
- **Placeholder scan:** The task instructions contain no unresolved work markers or unspecified test steps.
- **Type consistency:** `CampusBlockId`, `CAMPUS_BLOCKS`, `FINAL_BLOCK_ID`, `findCampusBlock`, and `GrowingCampusIntroProps` are introduced before later tasks consume them.
