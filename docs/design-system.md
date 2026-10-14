# Alumnity design system

The rules every page follows. Values live in `app/styles/tokens.css`; this explains
them. If a page needs something that isn't here, add a token — don't write a raw value
into a component.

## Language

Paper, pencil, ink. Real HKBK photographs appear as pencil sketches on warm paper and
come to life as ink blooms their colour in. A red pen line connects things. Patterns in
the margins are hand-drawn. Nothing is glossy: no drop-shadowed cards, no gradient
overlays, no carousels.

## Colour

| Token | Use |
|---|---|
| `--color-paper` `#f8f4ea` | Every background. |
| `--color-paper-raised` | Surfaces that sit on the paper (secondary buttons on hover). |
| `--color-ink` | Body text, headings that aren't the headline. |
| `--color-ink-muted` | Secondary text. 5.1 : 1. |
| `--color-ink-soft` | Kickers and notes. 5.8 : 1. |
| `--color-red` | The pen line, the headline, the swoosh. One red thing per view. |
| `--color-blue` | The wordmark, primary actions, links, focus. |
| `--color-gold` | Small accents only (the wordmark's dot, rules, bullets, the nav's current page). |
| `--color-gold-text` | Gold for a word picked out in a headline ("HKBK **memories**"). The brand gold is only 2.8 : 1 on paper; this is 4.0, fine for large text. |
| `--color-paper-veil` | See-through paper laid on a photo (an album's name band, a caption). Text on it uses ink or ink-soft, which stay above 4.5 : 1 even over a black photo. |
| `--color-night` … | The lightbox's dark ground and the light text and lines on it. |

Every text colour clears WCAG AA (4.5 : 1) on paper. "One red thing per view" means the
headline: rules, stems and markers beside it are gold or pencil. Text laid over a photo uses
`--halo` (or `--halo-strong` for small text) so it stays crisp.

## Type

Two families, each with one job: **Figtree** (`--font-ui`) for the interface, **Young
Serif** (`--font-voice`) for the human voice — the headline, years, captions. Young Serif
is upright only (it has no italic), so the voice is never set in italic. The "alumnity."
wordmark keeps its own face, DM Sans Bold (`--font-wordmark`), so the logo doesn't change
with the body font. Chosen side by side in the `/lab` page (development only).

| Token | Size | Use |
|---|---|---|
| `--text-label` | 12 px | Uppercase, tracked labels and kickers. |
| `--text-small` | 14 px | Navigation, notes, footer, links. |
| `--text-button` | 15 px | Buttons. |
| `--text-body` | 17–19 px | Body copy, at most `--measure-body` (34 characters) a line. |
| `--text-fine` | 13 px | Captions on photos, small card details. |
| `--text-card` | 21 px | Serif: a card's name. |
| `--text-caption` | 24 px | Serif: captions and section names (upright: Young Serif has no italic). |
| `--text-title` | 24–40 px | Section titles. |
| `--text-display` | 48–96 px | The landing page's headline. |
| `--text-page-title` | 40–72 px | Every other page's headline. |

Lines: the hero's text is at most `--measure-body` (34 characters); an inner page's
opening paragraph at most `--measure-page` (46).

## Space and layout

- An 8 px grid: `--space-1` (4) to `--space-10` (120). Use the tokens, not px.
- One grid for everything: put `.container` on each section. It's `--container` (1200 px)
  wide with a `--gutter` either side, so every page's edges line up with the nav's.
- Every control is at least `--tap-target` (44 px) tall.
- One focus ring everywhere (`:focus-visible` in `base.css`): 2 px blue, offset 3 px.

## Motion

- Purpose first. Motion explains (the pen joining the years), or confirms (a hover), or
  it isn't there. Everything respects `prefers-reduced-motion`.
- `--ease-out` for things arriving, `--ease-ink` for slow, deliberate moves.
- Things with mass move with weight (`lib/motion.ts`). The pen uses `passing`: it slows
  through each photo and hurries between them, but never stops. The camera follows the
  pen, a little behind, and eases into framing each photo as the pen passes through it;
  pull-backs use `settle` (a touch of overshoot, then rest). All are pure functions of
  time, so any frame can be reproduced (`?t=<ms>` freezes the intro on one).
- Nothing teleports. Whatever changes is on screen while it changes: each photo waits
  faintly, firms up as the pen nears it, and colours while it's framed.
- Long animations can be skipped and switched off (the intro's checkbox, the footer).
- One photograph blooms per page, once: the hero on the landing page, the cover on an
  album's page (`components/ink-bloom.tsx`, the same code for both). Grids of photos don't
  animate, photo by photo or on hover.

## Photographs

- Real HKBK photos only, of HKBK College of Engineering's own students and events, not the
  wider HKBK group's (its degree college, schools or other institutes). Record each one's
  source (see `lib/eras.ts`, `lib/gallery.ts`).
- Check what an event was, and when, against the college's own news pages
  (hkbk.edu.in, News & Events: each item names its department). Upload dates on the old
  portal are not event dates.
- Prepare them with `scripts/make-journey-photos.py` (the intro and hero: a colour and
  pencil-sketch pair, 1000 px for the intro, 1100 for the hero) or
  `scripts/make-gallery.py` (the gallery: every photo at 1600 px and 640 px, each album's
  cover at 1000 px with its sketch). Photos under 600 px wide are left out rather than
  shown blurred.
- An event that happened more than once is one album, with a part for each time.
- Photos of people need the college's sign-off before they go public.

## Videos

- Albums can hold videos from the college's own YouTube, Instagram, Facebook and LinkedIn:
  paste the link into `lib/gallery-videos.json` (album, part, link, title). A part can
  be just videos (a film about the campus, an alumni story). `lib/video.ts` reads the
  link; one it can't read fails the build.
- Nothing from those sites loads until someone presses play: a tile shows a still saved
  with the site (`scripts/fetch-video-posters.py` saves YouTube's own thumbnail), or a
  sheet of paper with the video's name. YouTube plays in its no-cookies player.
- Videos open in the lightbox with the photos, never autoplay on the page, and stop when
  the lightbox closes or moves on. Every video links to its original ("Watch on …").

## Files

```
app/styles/
  tokens.css    every value
  base.css      element defaults, .container, focus, utilities
  brand.css     the Alumnity lockup
  nav.css       the header every page shares, and the "opens soon" notice
  page.css      what every inner page shares: its head, the back link
  patterns.css  the hand-drawn margins
  intro.css     the intro
  landing.css   the hero and buttons
  footer.css    the footer
  gallery.css   the gallery (imported by its pages only)
  lab.css       the /lab page (development only)
```

Shared components get their own file, imported in `app/globals.css`. Styles only one
section uses (the gallery) are imported by that section's pages, so other pages don't
load them. Layout geometry (a column's width, a hero's size) may be written where it's
used; colours, type, space, radii and motion are always tokens.
