# Animated HKBK Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Alpha 4 landing page where a drawn HKBK campus resolves into real local campus photography before revealing Alumnity’s welcome hero.

**Architecture:** A small Next.js App Router application renders a client-side `CampusLanding` experience. A typed campus data module owns the four local image records and selected-building state; CSS owns the watercolour sky, SVG line drawing, marker transitions and responsive layouts. No database or existing Alpha 2/3 application code is imported.

**Tech Stack:** Next.js 15, React 19, TypeScript, plain CSS, Vitest, local image assets.

**Spec:** `docs/2026-10-13-animated-landing-design.md`

## Global Constraints

- Use only the copied files under `public/assets/campus/` at runtime; never reference the `D:` magazine archive.
- Show exactly four selectable locations and default to the CSE block after 5 seconds of idle time.
- Use one watercolour/pencil-map scene, one gold SVG route and one real photo handoff; no feed, sidebar, card grid, metrics, testimonials or admissions copy.
- Motion uses `transform`, `opacity`, SVG `stroke-dashoffset` and `clip-path`; reduced motion renders the final CSE photo and all copy immediately.
- Every marker is a keyboard-accessible button and works at desktop and 390 px mobile widths.

---

### Task 1: Create the standalone Alpha 4 frontend shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `vitest.config.ts`
- Create: `tests/campus.test.ts`

**Interfaces:**
- Consumes: Next.js App Router conventions.
- Produces: `npm run dev`, `npm run build`, `npm run test`, and a root route which renders `CampusLanding` in Task 3.

- [ ] **Step 1: Write the failing data test**

```ts
import { CAMPUS_STOPS, DEFAULT_STOP_ID } from "../lib/campus";

it("keeps four distinct local campus stops and defaults to CSE", () => {
  expect(CAMPUS_STOPS).toHaveLength(4);
  expect(DEFAULT_STOP_ID).toBe("cse-block");
  expect(CAMPUS_STOPS.every((stop) => stop.image.startsWith("/assets/campus/"))).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/campus.test.ts`

Expected: FAIL because the project and `lib/campus` do not exist.

- [ ] **Step 3: Create the minimal Next/Vitest configuration and root files**

```json
{
  "scripts": { "dev": "next dev", "build": "next build", "test": "vitest run" }
}
```

```tsx
export default function Page() {
  return <main>Loading Alumnity…</main>;
}
```

- [ ] **Step 4: Run the test and production build**

Run: `npm install; npm run test -- tests/campus.test.ts; npm run build`

Expected: The test still fails until Task 2; the empty root route builds.

- [ ] **Step 5: Commit the verified shell**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts app vitest.config.ts tests/campus.test.ts
git commit -m "feat: scaffold the Alpha 4 landing shell"
```

### Task 2: Define the four local campus stops

**Files:**
- Create: `lib/campus.ts`
- Modify: `tests/campus.test.ts`

**Interfaces:**
- Consumes: the five copied images under `public/assets/campus/`.
- Produces: `CampusStop`, `CAMPUS_STOPS`, `DEFAULT_STOP_ID`, and `findCampusStop(id)` for Task 3.

- [ ] **Step 1: Complete the failing test with marker identity checks**

```ts
expect(CAMPUS_STOPS.map((stop) => stop.id)).toEqual([
  "cse-block", "front-building", "glass-block", "tower",
]);
expect(findCampusStop("unknown")).toBeUndefined();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- tests/campus.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the typed local record**

```ts
export type CampusStop = {
  id: "cse-block" | "front-building" | "glass-block" | "tower";
  label: string;
  image: string;
  x: number;
  y: number;
};

export const DEFAULT_STOP_ID = "cse-block" as const;
export const CAMPUS_STOPS: CampusStop[] = [/* four local image records */];
export const findCampusStop = (id: string) => CAMPUS_STOPS.find((stop) => stop.id === id);
```

- [ ] **Step 4: Run unit tests and build**

Run: `npm run test -- tests/campus.test.ts; npm run build`

Expected: PASS and a successful production build.

- [ ] **Step 5: Commit the data boundary**

```bash
git add lib/campus.ts tests/campus.test.ts
git commit -m "feat: model the four HKBK landing stops"
```

### Task 3: Build the animated campus-to-hero experience

**Files:**
- Create: `components/campus-landing.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/campus.test.ts`

**Interfaces:**
- Consumes: `CAMPUS_STOPS`, `DEFAULT_STOP_ID`, and the local public image paths.
- Produces: A keyboard-accessible, reduced-motion-safe landing page that selects a marker, reveals the matching photo, and shows the two welcome actions.

- [ ] **Step 1: Add a static-render assertion before implementation**

```ts
import { renderToStaticMarkup } from "react-dom/server";
import { CampusLanding } from "../components/campus-landing";

it("renders the welcome message and both next actions", () => {
  const page = renderToStaticMarkup(<CampusLanding />);
  expect(page).toContain("Stay connected to where it began.");
  expect(page).toContain("Find your place");
  expect(page).toContain("I’m already here");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- tests/campus.test.ts`

Expected: FAIL because the placeholder page does not contain the welcome experience.

- [ ] **Step 3: Implement the client component and responsive CSS**

```tsx
const [selectedId, setSelectedId] = useState(DEFAULT_STOP_ID);
const [resolved, setResolved] = useState(false);

function selectStop(id: CampusStop["id"]) {
  setSelectedId(id);
  setResolved(false);
  window.setTimeout(() => setResolved(true), 620);
}
```

Implement four named marker buttons over an inline pencil-map SVG, an SVG gold route,
a local `<img>` element for the selected stop, a 5-second default-idle timer, and the
header/hero copy from the design spec. CSS includes `@media (prefers-reduced-motion:
reduce)` to remove the timer-dependent reveal and show the resolved state immediately.

- [ ] **Step 4: Run unit tests and production build**

Run: `npm run test; npm run build`

Expected: PASS and successful production build.

- [ ] **Step 5: Perform visual checks in a live browser**

Run: `npm run dev`

Check at 1280 px and 390 px: default CSE resolution, each of four marker photo
handoffs, keyboard marker selection, reduced-motion mode, and hero readability.

- [ ] **Step 6: Commit the working landing**

```bash
git add app/page.tsx app/globals.css components/campus-landing.tsx tests/campus.test.ts
git commit -m "feat: animate the HKBK campus landing"
```

## Self-review

- Spec coverage: Tasks 2–3 cover the four real, local stops; the SVG map, sky, route,
  photo handoff, hero, responsive layout, keyboard controls, default idle state and
  reduced-motion path. Task 1 supplies the isolated runnable shell.
- No placeholders: every task names exact files, commands, interfaces and expected
  behavior. The `CampusStop` data and `CampusLanding` component are the only public
  implementation boundaries.
- Type consistency: `CampusStop.id`, `DEFAULT_STOP_ID`, `CAMPUS_STOPS`, and
  `findCampusStop` are defined in Task 2 and consumed by Task 3.
