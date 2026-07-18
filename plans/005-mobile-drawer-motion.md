# 005 — Animate mobile nav drawer enter/exit

- **Status**: TODO
- **Commit**: 2ba66d7
- **Severity**: LOW
- **Category**: Missed opportunities
- **Estimated scope**: 2 files, ~40 lines

## Problem

Mobile menu mounts/unmounts instantly with no spatial motion. The drawer teleports, which feels abrupt for an occasional (not high-frequency) overlay.

```tsx
/* apps/web/src/components/MobileNav/MobileNav.tsx:92-114 — current */
{variant === "home" && menuOpen ? (
  <div className={styles.menuRoot} ...>
    <button className={styles.menuBackdrop} ... />
    <nav className={styles.menuPanel} ...>
```

No CSS enter/exit on `.menuPanel` or `.menuBackdrop`.

## Target

**Backdrop**: fade `opacity` 0 → 1 over 200ms ease-out.

**Panel**: `transform: translateX(-100%)` → `translateX(0)` over 250ms `var(--ease-drawer)` where `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`.

Use CSS transitions on mount — simplest path without new dependencies:

1. Add `data-open="true"` on `menuRoot` when open.
2. Default panel/backdrop styles = closed state.
3. `[data-open="true"]` selectors apply open state.
4. On close: either keep panel mounted 250ms before unmount (small state in TSX) OR use `@starting-style` if browser support is acceptable.

Recommended TSX pattern for exit animation:

```tsx
const [visible, setVisible] = useState(false);
const [open, setOpen] = useState(false);
// open=true → setVisible(true) immediately
// open=false → remove data-open, setTimeout 250ms → setVisible(false)
```

```css
.menuBackdrop {
  opacity: 0;
  transition: opacity 200ms var(--ease-out);
}
.menuRoot[data-open="true"] .menuBackdrop {
  opacity: 1;
}

.menuPanel {
  transform: translateX(-100%);
  transition: transform 250ms var(--ease-drawer);
}
.menuRoot[data-open="true"] .menuPanel {
  transform: translateX(0);
}
```

Under `prefers-reduced-motion: reduce`: skip transform; opacity-only or instant open is fine.

## Repo conventions to follow

- `MobileNav.module.css` — panel already uses coral gradient edge (no side-tab border).
- Plan **001** provides `--ease-out` and `--ease-drawer`.

## Steps

1. Ensure plan **001** is applied.
2. Add closed/open CSS states to `MobileNav.module.css` per **Target**.
3. Refactor `MobileNav.tsx` to keep `menuRoot` mounted while `visible`, toggle `data-open` for enter/exit, delay unmount ~250ms on close.
4. Ensure `document.body.style.overflow` lock still pairs with visible menu lifecycle.
5. Add reduced-motion override: `@media (prefers-reduced-motion: reduce) { .menuPanel { transition: none; transform: none; } }`

## Boundaries

- Do NOT add Framer Motion or React Spring.
- Do NOT animate keyboard Escape close differently from backdrop click.
- Do NOT change menu link styles.

## Verification

- **Mechanical**: `pnpm --filter web test -- MobileNav` — existing tests must pass; update tests if they assumed instant mount.
- **Feel check**: Mobile viewport → open menu. Panel slides from left; backdrop fades. Close via backdrop — reverse plays before unmount. Escape close same. Reduced motion: no slide, optional instant or fade-only.
- **Done when**: Open/close has visible 200–250ms motion on capable devices; no layout shift on `body` scroll lock.
