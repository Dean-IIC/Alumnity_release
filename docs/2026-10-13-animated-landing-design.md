# Animated landing: HKBK, then Alumnity

## Goal

Make the first visit feel like returning to HKBK, then make the product purpose clear:
this is a network where HKBK people ask, guide, and grow together. It is not an
admissions page and not a generic social-network dashboard.

## The one visual idea

**A drawn campus becomes the real campus.**

The opening is a lightly watercoloured sky and a hand-drawn aerial illustration of
HKBK. Four labelled building points sit on the drawing. The visitor may choose one,
or wait for the default HKBK College of Engineering point. The camera moves into that
point; its pencil outline resolves into the matching real photograph. The landing hero
then settles over that photo.

The four locations must use real HKBK assets selected from the full
`D:\college news letter HKBK` archive, especially its 67-photo
`claude-studio\original images` collection and the curated `newgen2\assets\campus`
and `upload-to-canva\05-campus` sets. The initial implementation must inspect the
full library first, deduplicate repeated exports, then choose the best distinct views.
The map scene is an original watercolor-and-ink treatment derived from the real HKBK
aerial photo and checked against the satellite layout. It is revealed in four spatial
slices—arrival, west edge, engineering heart, and east wing—so the visitor first learns
how the campus fits together. The resolution photographs remain real local HKBK assets.

The initial landing selection is copied into the repository at
`public/assets/campus/` so the page has no runtime dependency on the magazine drive:

- `aerial.png` — the drawn-campus reference and opening view.
- `hkbk-campus-atlas.png` — the locally stored, art-directed aerial atlas used for the
  four progressive illustration slices.
- `cse-block.jpg` — the default College of Engineering resolution.
- `front-building.jpg`, `glass-block.png`, `tower.png` — the other three exploratory
  building stops.

## Sequence

1. **Sky (0–300 ms).** A pale watercolour sky fades in.
2. **Map (80–1,700 ms).** Four actual illustrated campus slices reveal in their real
   spatial relationship: arrival, west edge, engineering heart, then east wing.
3. **Explore (1,700 ms onward).** Four actual building markers appear in a short
   stagger. Hover/focus highlights a marker and shows its name. The initial scene is
   interactive immediately; the animation never blocks navigation.
4. **Choose (visitor action or 5 s idle).** Selecting a marker moves the shared map
   location toward the viewport centre. A gold route draws to the selected building.
5. **Resolve (about 700 ms).** The campus atlas crossfades and clips into that
   building's real photograph. The photo remains still after it resolves.
6. **Welcome.** The hero copy, "Stay connected to where it began.", and the two
   primary paths appear: **Find your place** and **I'm already here**.

The default idle choice should be HKBK College of Engineering. Selecting a different
location preserves the same landing copy but uses that location's photo.

## Layout and visual rules

- Full-bleed, bright ivory canvas. No sidebar, dashboard, card grid or conventional
  SaaS hero.
- Watercolour sky sits at the top; the illustrated atlas sits at the lower half; real photo
  occupies the lower/right edge after selection.
- Campus blue (`#123E68`) structures text and controls. Gold (`#D59A2D`) belongs only
  to the route, active marker and short underline. Ink is `#162430`.
- Display type is expressive but limited to the hero headline. Navigation and body
  copy are clear sans serif.
- The final hero has just two actions. It does not show promotion statistics,
  testimonials, admissions language, a carousel or a feed.

## Motion rules

- Use transform and opacity for movement; keep motion at 60 fps.
- Map line uses SVG stroke drawing; it is the only ambient/expressive movement.
- Marker selection uses small press feedback, not bounce.
- The photo handoff uses a continuity transition, not a flash or hard cut.
- `prefers-reduced-motion` skips the drawing/travel and shows the final selected photo
  with all content immediately.
- Keyboard users can select every building marker; pointer and keyboard have the same
  outcome.

## First implementation boundary

Create an isolated, runnable Alpha 4 frontend shell containing only this landing
experience and local image assets. Do not bring Alpha 2 or Alpha 3's application shell,
authentication, database, feed, Rooms or Roles into this slice.

## Acceptance checks

- Desktop and mobile layouts remain readable at 1280 px and 390 px widths.
- Exactly four real HKBK building markers are shown.
- The default and every selectable marker resolves into a local, real image.
- The motion sequence can be skipped, replayed and reduced safely.
- The landing page tells a visitor what Alumnity is and provides distinct join/sign-in
  routes, without reading as college promotion.
