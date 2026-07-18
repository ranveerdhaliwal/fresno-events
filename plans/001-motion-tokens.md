# 001 — Add shared motion tokens

- **Status**: TODO
- **Commit**: 2ba66d7
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 2 files, ~25 lines

## Problem

Easing and duration are hand-typed per component with inconsistent values:

```css
/* apps/web/src/components/Button/Button.module.css:12 — current */
transition:
  background 0.15s ease,
  border-color 0.15s ease,
  color 0.15s ease;
```

```css
/* apps/web/src/components/EventRow/EventRow.module.css:21 — current */
transition: transform 0.1s ease, box-shadow 0.1s ease;
```

```css
/* apps/web/src/components/DayDateCarousel/DayDateCarousel.module.css:21 — current */
transition: transform 360ms cubic-bezier(0.25, 0.1, 0.25, 1);
```

Five near-matching curves with no shared vocabulary makes future motion work drift.

## Target

Add tokens to `apps/web/src/styles/tokens.css`:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-press: 120ms;
  --duration-hover: 150ms;
  --duration-row: 100ms;
  --duration-panel: 250ms;
}
```

Do not change component files in this plan — only add tokens.

## Repo conventions to follow

- Design tokens live in `apps/web/src/styles/tokens.css` alongside `--font-*` and `--shadow-*`.
- Semantic theme roles stay in `theme.css`; motion primitives belong in `tokens.css`.

## Steps

1. Open `apps/web/src/styles/tokens.css`.
2. After the `--rainbow-stripe-height-mobile` block (end of `:root`), append the motion token block from **Target**.
3. Optionally add a one-line note under **Motion** in root `DESIGN.md` prose: tokens are defined in `tokens.css` — no frontmatter change required unless you want `motion` keys in the sidecar.

## Boundaries

- Do NOT edit component CSS in this plan.
- Do NOT add npm dependencies.
- Do NOT change `global.css` reduced-motion rules.

## Verification

- **Mechanical**: `pnpm --filter web exec tsc --noEmit` (or project typecheck) passes.
- **Feel check**: N/A — tokens only.
- **Done when**: `tokens.css` exports all six variables and `grep --ease-out apps/web/src/styles/tokens.css` matches.
