---
name: What Up Fresno
description: Warm Valley postcard aesthetic for local event discovery — playful, scannable, community-first.
colors:
  coral: "#d85a3c"
  coral-dark: "#b3401c"
  mustard: "#f2c14e"
  olive: "#6b8e4e"
  ink: "#14181d"
  cream-page: "#f4e8d0"
  linen-inset: "#faf1dc"
  paper-card: "#ffffff"
  navy-page: "#1f2a33"
  warm-paper: "#e6d4ac"
  teal-label: "#2e5266"
  teal-label-muted: "#7aa9c2"
  status-success: "#2d6a4f"
  status-warning: "#b45309"
  status-danger: "#b42318"
typography:
  display:
    fontFamily: '"Alfa Slab One", serif'
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: '"Alfa Slab One", serif'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: '"Alfa Slab One", serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: '"Work Sans", system-ui, sans-serif'
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-compact:
    fontFamily: '"Work Sans", system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: '"Alfa Slab One", serif'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.27em"
  script:
    fontFamily: '"Yellowtail", cursive'
    fontSize: "1.15em"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  nav-title:
    fontFamily: '"Alfa Slab One", serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.15em"
rounded:
  sm: "4px"
  pill: "999px"
  none: "0"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-approve:
    backgroundColor: "{colors.mustard}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
  event-row:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 16px 12px 12px"
---

# Design System: What Up Fresno

## 1. Overview

**Creative North Star: "The Valley Postcard"**

What Up Fresno looks like a well-loved community bulletin pulled from a corkboard: warm paper, bold slab headlines, a coral-and-mustard stripe, and ink-dark borders that feel printed rather than rendered. The default **dim** theme pairs navy page backgrounds with warm paper cards so listings pop like pinned flyers. Light theme preserves the original cream-and-linen daytime look.

The system serves a **product** register: discovery and admin curation must stay scannable first, playful second. Personality lives in typography, the rainbow stripe, postcard shadows, and selective script accents — not in decorative gradients, glass panels, or hero-metric theatrics.

**Key Characteristics:**

- Postcard offset shadows (`2px 2px 0` through `7px 7px 0`) instead of soft ambient blur
- Sharp corners on cards and rows; pills reserved for buttons and chips
- Three-font stack: Alfa Slab One (display/labels), Work Sans (body), Yellowtail (accent script only)
- Dim theme default: navy page + warm paper cards + cream-tinted shadows on page
- Halftone dot texture on page backgrounds
- Rainbow stripe (`--rainbow-stripe`) as brand signature, not generic gradient mesh
- Focus and selection use mustard (`3px solid`), never glow rings

## 2. Colors

A Central Valley palette: sun-warmed corals and mustards on paper, teal for metadata labels, olive for free/admission cues, ink for structure.

### Primary

- **Fresno Coral** (`#d85a3c` / `--coral`): Prices, live badges, accent emphasis, rainbow stripe segment. Use for action and energy, not large fills.
- **Coral Dark** (`#b3401c` / `--coral-dark`): Reject/destructive text, darker coral states.

### Secondary

- **Valley Mustard** (`#f2c14e` / `--mustard`): Primary CTA fills (approve buttons), focus rings, selection highlight, nav hover, rainbow stripe segment.
- **Olive Grove** (`#6b8e4e` / `--olive`): Free admission, positive secondary accents.

### Tertiary

- **Teal Label** (`#2e5266` / `--text-label`): Category labels, metadata, venue/time chips on cards.
- **Teal Label Muted** (`#7aa9c2` / `--text-label-muted`): De-emphasized labels on page backgrounds.

### Neutral

- **Ink** (`#14181d` / `--ink`): Nav bar, borders, primary text on paper, shadow color.
- **Navy Page** (`#1f2a33`): Default page background (dim theme).
- **Warm Paper** (`#e6d4ac`): Card and row surfaces on dim theme.
- **Cream Page** (`#f4e8d0`): Light theme page background.
- **White Paper** (`#ffffff`): Light theme card surface.
- **Cream Text on Navy** (`#e8d9b8` / `--text-on-page`): Body copy on dim page backgrounds.

### Named Rules

**The Postcard Ink Rule.** Borders and shadows use ink (or cream-tinted ink on navy), never colored glows or purple gradients.

**The One Script Rule.** Yellowtail appears only for deliberate personality moments — never for body copy or long headings.

## 3. Typography

**Display Font:** Alfa Slab One (serif) — logos, nav links, section headers, date numerals, prices.

**Body Font:** Work Sans (system-ui fallback) — descriptions, form fields, meta lines. Base size 14.5px, line-height 1.5.

**Script Font:** Yellowtail (cursive) — accent only via `Text` variant `script`.

**Character:** Retro bulletin-board confidence. Slab display + clean sans body keeps long event lists readable while headlines feel local and bold.

### Hierarchy

- **Display** (Alfa Slab, 28px / `header1`, line-height 1.2): Page titles, major section heads.
- **Headline** (Alfa Slab, 20px semibold / `header2`, line-height 1.25): Subsection titles.
- **Title** (Alfa Slab, 16px / `header3`, line-height 1.3): Card titles, compact headers.
- **Body** (Work Sans, 14–14.5px / `body1`–`body3`, line-height 1.45–1.55): Descriptions; cap at 65–75ch on prose blocks.
- **Label** (Alfa Slab, 11px uppercase, letter-spacing 0.27em / `eyebrow`): Section kickers, category tags, date abbreviations.
- **Script** (Yellowtail, 1.15em / `script`): Sparingly for delight.

### Named Rules

**The Text Component Rule.** Use `Text` variants instead of ad-hoc `font-family` / `font-size` in feature CSS.

## 4. Elevation

Depth is **structural and printed**, not atmospheric. Cards and rows use hard offset shadows that mimic stacked paper. Hover lifts translate `(-1px, -1px)` with a slightly larger shadow — tactile, not floaty.

Dim theme softens shadow opacity (`--shadow-opacity: 0.68`) on warm paper so offsets don't feel harsh. Light theme uses full-opacity ink shadows.

### Shadow Vocabulary

- **xs** (`2px 2px 0`): Date chips, compact elements.
- **sm** (`3px 3px 0`): Secondary buttons.
- **md** (`4px 4px 0`): Event cards.
- **lg / card-on-page** (`5px 5px 0`): Event rows, primary list items on page background.
- **hover** (`7px 7px 0` or `6px 6px 0` cream-tinted): Row hover lift.

### Named Rules

**The Flat Card Interior Rule.** No nested cards. Inset areas use `--surface-inset` / `--surface-muted` tonal shift, not a second bordered box.

**The No Glass Rule.** No `backdrop-filter` glass panels. Surfaces are opaque paper or nav ink.

## 5. Components

### Buttons

- **Shape:** Pill (`border-radius: 999px`). Sizes: `xs` (28px), `sm` (34px), `md` (38px min-height).
- **Approve (primary action):** Mustard fill, ink border 1.5px, ink text, weight 600.
- **Reject:** Coral-tinted background, coral-dark text, coral-mixed border.
- **Secondary:** Paper card background, ink border-card, xs shadow; hover border shifts to mustard.
- **Ghost:** Transparent, muted page text; no shadow.
- **Hover / Focus:** 0.15s ease on background/border/color. Focus ring: `3px solid mustard` (global `--focus-ring`).

### Cards / Containers

- **Event row:** Sharp corners, warm paper background, 1.5px ink/cream border, 5px offset shadow, grid layout (date | thumb | body | price). Hover: translate + shadow bump.
- **Event card (mobile):** 58px date column + body; md shadow; hidden on desktop (rows preferred).
- **Corner Style:** 0px on list surfaces; chips may use bordered squares.
- **Internal Padding:** 12–16px; gap 12–14px in grids.

### Chips

- **Date chip:** `--surface-chip` background, bordered, xs shadow, coral dow abbreviation.
- **Weather / air quality chips:** Compact, label typography, semantic color from data — not rainbow defaults.

### Inputs / Fields

- Shared control styles in `FormControls/control.module.css`.
- Focus: mustard outline ring, not blue browser default alone.
- Borders: `--border-default` (ink) or `--border-card`.

### Navigation

- **TopNav:** Ink (`--surface-nav`) bar, cream text, Alfa Slab links with 2px letter-spacing. Active: mustard bottom border. Logo with drop-shadow offset.
- **MobileNav:** Full-screen drawer; ink background; menu links with subtle dividers. Drawer leading edge uses a coral-tinted gradient wash (not a side-tab border).
- **Rainbow stripe:** 6px repeating linear gradient (coral / ink / mustard) below nav — signature brand element.

### Signature Components

- **RainbowStripe:** Desktop and mobile variants; do not replace with generic mesh gradients.
- **EventRow live pulse:** Subtle opacity animation; respects `prefers-reduced-motion`.

## 6. Do's and Don'ts

### Do:

- **Do** use semantic theme tokens (`--surface-page`, `--text-on-page`, `--border-card-on-page`) — never hardcode theme-specific hex in components.
- **Do** keep list scanning fast: clear date column, venue/time meta in teal label color, price in coral.
- **Do** use postcard shadows and ink borders for depth.
- **Do** honor `prefers-reduced-motion` (global.css zeroes animation/transition duration).
- **Do** tint neutrals toward brand warmth; ink `#14181d` is the near-black, not pure `#000`.
- **Do** handle incomplete event data gracefully (placeholder images, unknown price states).

### Don't:

- **Don't** use purple gradients, glassy card piles, bland icon-card grids, dark glows, or aesthetics that could fit any startup (per PRODUCT.md).
- **Don't** use gradient text (`background-clip: text`) on headings.
- **Don't** nest cards inside cards — use inset surface tones instead.
- **Don't** use bounce or elastic easing; prefer `ease` / `ease-out` under 200ms for hovers.
- **Don't** use em dashes in copy.
- **Don't** add modal dialogs when inline expansion or navigation suffices.
- **Don't** default to Inter, Space Grotesk, or generic SaaS hero-metric layouts (big number + small label grids).
- **Don't** animate layout properties (`width`, `height`, `margin`); transform and opacity only.
