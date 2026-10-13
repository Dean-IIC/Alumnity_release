# Animated landing: HKBK, then Alumnity

## Goal

The first visit should feel like a remembered walk across HKBK, then make the
product purpose unmistakable: Alumnity is where HKBK people ask, guide, and grow
together. It is not an admissions page or a generic social-network dashboard.

## The visual idea

**One ink drop grows the campus, then the campus becomes real.**

The opening canvas is warm paper, not a map. A small red route beacon explores from
the east/A-CSE edge toward D on a wandering route. As it travels, dynamic topographic
contours, leaf sprigs and five pencil-and-wash building illustrations grow in the
physical campus order supplied by the team:

**A/CSE → Admin → B → C → D**

When the beacon reaches each stop, that illustration is overtaken by a clipped local
HKBK photograph. The complete route remains as a quiet memory under the landing,
rather than turning the scene into an interactive campus directory.

The visual assets live entirely in the repository under
`public/assets/campus/growing-intro/`:

- `a-cse-ink.png`, `admin-ink.png`, `b-ink.png`, `c-ink.png`, `d-ink.png` —
  individual transparent pencil-and-wash illustrations; these are art, not CSS
  block geometry.
- `cse-block.jpg`, `glass-block.png`, `front-building.jpg`, `tower.png`, and
  `d-block-real.jpg` — the local photographs that resolve each illustrated stop.

The original drone video and all source photos remain outside the app; the browser
never serves media from Downloads or the magazine archive.

## Sequence

1. **Paper (0–260 ms).** A warm, lightly textured sheet appears.
2. **Explore (760–6,360 ms).** A red route beacon travels A/CSE → Admin → B → C → D
   through topographic contour lines.
3. **Resolve (at each arrival).** Each stop grows its leaves and pencil illustration,
   then is overtaken by its own clipped real photograph.
4. **Settle (at 8 s or by Skip intro).** The completed drawing becomes a low-contrast
   memory. The welcome header, purpose, two routes, and a real HKBK facade arrive.

The transition is deliberate, but it never traps a visitor: **Skip intro** moves
directly to the welcome state.

## Layout and visual rules

- Full-bleed ivory paper; no sidebar, pins, dashboard cards, aerial atlas, or SaaS
  metric grid.
- Illustration palette: paper `#F8F4EA`, sepia ink `#3A2921`, muted leaf wash
  `#788358`, and route red `#A83932`. Campus blue `#143F68` is reserved for the
  Alumnity wordmark and primary action once the welcome state arrives.
- DM Serif Display carries the remembered, human headline; DM Sans keeps navigation
  and actions crisp.
- The final hero makes just two routes visible: **Find your place** and **I’m already
  here**. It has no promotion statistics, testimonials, admissions language, carousel,
  or feed.

## Motion and access rules

- The route is SVG stroke drawing; the beacon is a small SVG path-following marker;
  building/photo reveals use opacity, transform, and clipping.
- The animation serves first-visit explanation: it makes the physical route and each
  drawing-to-photo transition legible. There is no looping ambient flourish.
- `prefers-reduced-motion` skips the timed choreography and shows the settled welcome
  state immediately.
- The welcome controls are ordinary links with clear labels. The decorative ink scene is
  hidden from screen readers behind a concise section label.
- Mobile keeps the same A-to-D order, with the illustration scaled and the colour photo
  moved behind the hero copy.

## Acceptance checks

- The data order is exactly A/CSE, Admin, B, C, D.
- The intro runs in about eight seconds and can be skipped.
- The final landing visibly explains Alumnity without turning into a college advert.
- The desktop landing has been visually checked in the browser; it has no browser
  console warnings or errors.
