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

The four locations must use the real assets supplied in
`D:\college news letter HKBK\upload-to-canva\05-campus`; no generated campus imagery
is used in the implementation.

## Sequence

1. **Sky (0–600 ms).** A pale watercolour sky fades in. The campus outline draws in
   with a reduced-motion-safe opacity fallback.
2. **Explore (600 ms onward).** Four actual building markers appear in a short
   stagger. Hover/focus highlights a marker and shows its name. The initial scene is
   interactive immediately; the animation never blocks navigation.
3. **Choose (visitor action or 5 s idle).** Selecting a marker moves the shared map
   location toward the viewport centre. A gold route draws to the selected building.
4. **Resolve (about 700 ms).** The pencil silhouette crossfades and clips into that
   building's real photograph. The photo remains still after it resolves.
5. **Welcome.** The hero copy, "Stay connected to where it began.", and the two
   primary paths appear: **Find your place** and **I'm already here**.

The default idle choice should be HKBK College of Engineering. Selecting a different
location preserves the same landing copy but uses that location's photo.

## Layout and visual rules

- Full-bleed, bright ivory canvas. No sidebar, dashboard, card grid or conventional
  SaaS hero.
- Watercolour sky sits at the top; the pencil map at the lower half; real photo
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
