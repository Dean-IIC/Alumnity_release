# Growing campus ink intro

## Intent

Replace the current illustrated aerial-map opening with a paper-and-ink animation that
draws the HKBK College of Engineering campus in the order supplied by the student:
**A/CSE → Admin → B → C → D**. The page must feel like a campus memory taking root,
not like a navigation map or a promotional website.

The supplied location sketch establishes that the five blocks are a long campus spine:
A/CSE at the right/east end, then Admin, B, C, and D at the left/west end. The supplied
drone video is visual reference for the campus approach, foliage, façade material, and
open ground; it is not embedded, uploaded, or played by the site.

## Visual direction

- The opening canvas is warm paper white (`#F8F4EA`), with no cards, sidebar, map pins,
  dashboard UI, or aerial-image collage.
- Line art starts in dark brown ink (`#3A2921`) on the paper. Muted leaf wash
  (`#6E7B52`) may appear only as the foliage grows. HKBK blue is reserved for the real
  final photograph and the small welcome controls; it does not colour the ink drawing.
- The composition follows the actual block order from right to left. It does not invent
  a courtyard, circular campus, or extra building zones.
- Each drawn building is a distinct, photo-informed ink illustration rather than a
  generic rectangle. The art has imperfect line weight, shallow façade depth, and trees
  rooted into the same route.

## First-visit sequence

1. **Paper (0–350 ms).** A quiet paper surface is visible. Navigation and product copy
   remain absent or nearly transparent so the opening has a clean stage.
2. **Drop (350–1,000 ms).** One sepia ink drop falls onto the A/CSE end of the route.
   Its landing is a single soft blot, not a bouncing UI effect.
3. **A/CSE grows (1,000–2,600 ms).** A root-like ink path grows leftward from the
   landing point. A small cluster of leaves grows, followed by the A/CSE line
   illustration. The building holds briefly before the route continues.
4. **Campus grows (2,600–6,900 ms).** The same living route reaches Admin, B, C, then
   D. Each stop uses a 120–180 ms leaf/root lead-in and an approximately 900 ms building
   drawing. The route never teleports, reverses, or branches into imagined buildings.
5. **Resolve (6,900–8,000 ms).** The complete brown-and-white campus rests for a beat.
   D block's drawing gently gives way to its local real campus photograph and reveals
   the quiet Alumnity welcome: “Stay connected to where it began.”

The opening is an occasional, explanatory first-visit animation. A visible “Skip
intro” control appears once the ink drop lands. It takes the visitor directly to the
same D-block welcome state. Keyboard focus and reduced-motion users get the settled
real-photo welcome with a static, faint ink-campus backdrop.

## Architecture

The landing gets a dedicated `GrowingCampusIntro` client component. It renders five
static, individually addressable campus-stop layers from ordered data; CSS controls the
predetermined drop, root, foliage, and line-art stagger. JavaScript owns only the
settled/skipped state and a safe timeout; it does not animate frames.

`lib/campus.ts` becomes the single source of truth for the physical order and artwork
positions. It exposes five campus stops (`a-cse`, `admin`, `b`, `c`, `d`) in route order,
and the route/headline code consumes that list. The existing generic aerial atlas and
its arbitrary marker positions are removed from the opening rather than hidden behind
new CSS.

The first implementation uses locally stored HKBK references only. Any extracted drone
stills, generated derivative illustration assets, or final image assets are stored under
`public/assets/campus/growing-intro/`; nothing is served from Downloads or the magazine
drive at runtime.

## Motion contract

- Purpose: **explanation and spatial consistency** for a rare first visit.
- Tool: CSS keyframes for the predetermined sequence; React state only for skip/settle.
- Properties: `opacity`, `transform`, and SVG `stroke-dashoffset`; a mask/clip may
  reveal a building illustration but layout properties do not animate.
- Curves: `cubic-bezier(0.23, 1, 0.32, 1)` for entries and
  `cubic-bezier(0.77, 0, 0.175, 1)` for the slow on-page root growth.
- Reduced motion: no falling drop, travel, or sequential drawing. Show the final page
  with opacity-only reveal and preserve every action.
- Replaying is deliberately avoided. The sequence runs on page load; “Skip intro” and
  automatic completion are stable state transitions, not restartable keyframes.

## Verification

- Unit-test the five-stop route order and the fact that the final stop is D.
- Unit-test the default settled stop and local asset paths used by the final photo.
- Typecheck the new component and verify the animation has a keyboard-accessible skip
  action.
- Inspect desktop and mobile preview states: immediately after load, during the A/CSE
  drawing, during the D drawing, settled, skipped, and `prefers-reduced-motion`.
