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
| `--color-gold` | Small accents only (the wordmark's dot, rules, bullets). |

Every text colour clears WCAG AA (4.5 : 1) on paper. Text laid over a photo uses
`--halo` (or `--halo-strong` for small text) so it stays crisp.

## Type

Two families, each with one job: **DM Sans** (`--font-ui`) for the interface, **DM Serif
Display** (`--font-voice`) for the human voice — the headline, years, captions.

| Token | Size | Use |
|---|---|---|
| `--text-label` | 12 px | Uppercase, tracked labels and kickers. |
| `--text-small` | 14 px | Navigation, notes, footer, links. |
| `--text-button` | 15 px | Buttons. |
| `--text-body` | 17–19 px | Body copy, at most `--measure-body` (34 characters) a line. |
| `--text-caption` | 24 px | Serif italic captions. |
| `--text-title` | 24–40 px | Section titles. |
| `--text-display` | 48–96 px | The page's one headline. |

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

## Photographs

- Real HKBK photos only. Record each one's source (see `lib/eras.ts`).
- Prepare them with `scripts/make-journey-photos.py`, which makes the colour and
  pencil-sketch pair and sizes them for display (1000 px for the intro, 1100 for the hero).
- Photos of people need the college's sign-off before they go public.

## Files

```
app/styles/
  tokens.css    every value
  base.css      element defaults, .container, focus, utilities
  brand.css     the Alumnity lockup
  patterns.css  the hand-drawn margins
  intro.css     the intro
  landing.css   nav, hero, buttons, notice
  footer.css    the footer
```

New components get their own file, imported in `app/globals.css`.
