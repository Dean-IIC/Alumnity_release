# Animated landing: HKBK, then Alumnity

## Goal

The first visit should feel like a remembered walk across HKBK, then make the
product purpose unmistakable: Alumnity is where HKBK people ask, guide, and grow
together. It is not an admissions page or a generic social-network dashboard.

## The visual idea

**One ink drop grows the campus, then the campus becomes real.**

The opening canvas is warm paper, not a map. A single sepia ink drop lands on the
east/A-CSE edge and sends a root-like stroke westward. As it travels, small leaf
sprigs and five individual pencil-and-wash building illustrations grow in the
physical campus order supplied by the team:

**A/CSE → Admin → B → C → D**

The finished drawing remains as a quiet memory under the landing. A local real
HKBK building photograph resolves at the right of the welcome copy, rather than
turning the scene into an interactive campus directory.

The visual assets live entirely in the repository under
`public/assets/campus/growing-intro/`:

- `a-cse-ink.png`, `admin-ink.png`, `b-ink.png`, `c-ink.png`, `d-ink.png` —
  individual transparent pencil-and-wash illustrations; these are art, not CSS
  block geometry.
- `d-block-real.jpg` — a local real HKBK photograph used in the welcome reveal.

The original drone video and all source photos remain outside the app; the browser
never serves media from Downloads or the magazine archive.

## Sequence

1. **Paper (0–260 ms).** A warm, lightly textured sheet appears.
2. **Drop (260–1,000 ms).** One sepia ink drop lands above A/CSE.
3. **Grow (1,000–6,700 ms).** A root/stroke draws from A/CSE through Admin, B,
   C, and D. Each stop grows leaves and its own building illustration in order.
4. **Settle (at 8 s or by Skip intro).** The completed drawing becomes a low-contrast
   memory. The welcome header, purpose, two routes, and a real HKBK facade arrive.

The transition is deliberate, but it never traps a visitor: **Skip intro** moves
directly to the welcome state.

## Layout and visual rules

- Full-bleed ivory paper; no sidebar, pins, dashboard cards, aerial atlas, or SaaS
  metric grid.
- Illustration palette: paper `#F8F4EA`, sepia ink `#3A2921`, and muted leaf wash
  `#788358`. Campus blue `#143F68` is reserved for the Alumnity wordmark and primary
  action once the welcome state arrives.
- DM Serif Display carries the remembered, human headline; DM Sans keeps navigation
  and actions crisp.
- The final hero makes just two routes visible: **Find your place** and **I’m already
  here**. It has no promotion statistics, testimonials, admissions language, carousel,
  or feed.

## Motion and access rules

- The ink route is SVG stroke drawing; building reveals use only opacity and transform.
- The drop is the only dramatic movement. There is no looping ambient flourish.
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
