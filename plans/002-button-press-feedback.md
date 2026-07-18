# 002 — Add button press feedback

- **Status**: TODO
- **Commit**: 2ba66d7
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, ~15 lines

## Problem

`Button` has hover color transitions but no `:active` press state. Taps feel disconnected on mobile and desktop.

```css
/* apps/web/src/components/Button/Button.module.css:1-16 — current */
.base {
  ...
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
/* no :active rule */
```

Pressable list rows (`EventRow`) lift on hover but also lack `:active` feedback.

## Target

```css
.base {
  transition:
    background var(--duration-hover) var(--ease-out),
    border-color var(--duration-hover) var(--ease-out),
    color var(--duration-hover) var(--ease-out),
    transform var(--duration-press) var(--ease-out);
}

.base:active:not(:disabled) {
  transform: scale(0.97);
}
```

Requires **001-motion-tokens** (`--duration-press`, `--duration-hover`, `--ease-out`).

## Repo conventions to follow

- `Button.module.css` is the canonical button; variants inherit via `.base`.
- Postcard hover lift pattern: `EventRow` uses `translate(-1px, -1px)` — buttons use scale press instead (smaller hit target).

## Steps

1. Ensure plan **001** is applied (tokens exist).
2. In `apps/web/src/components/Button/Button.module.css`, update `.base` `transition` to use tokens and include `transform`.
3. Add `.base:active:not(:disabled) { transform: scale(0.97); }` after `.base:disabled`.
4. Optional follow-up (out of scope unless trivial): mirror `:active { transform: translate(0, 0); }` on `.row` in `EventRow.module.css` to cancel hover lift while pressed.

## Boundaries

- Do NOT change button colors or border styles.
- Do NOT add Framer Motion.
- Do NOT animate on `:disabled` buttons.

## Verification

- **Mechanical**: `pnpm --filter web test -- Button` if Button tests exist; otherwise typecheck.
- **Feel check**: Open any admin page with Approve/Reject buttons. Click and hold — button should compress slightly (0.97) and release instantly. In DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` — press feedback may remain (scale is feedback, not decoration); confirm it still feels acceptable.
- **Done when**: All `.base` buttons show visible press compression on `:active`.
