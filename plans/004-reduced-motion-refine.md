# 004 — Refine prefers-reduced-motion handling

- **Status**: TODO
- **Commit**: 2ba66d7
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, ~15 lines

## Problem

Global reduced-motion rule zeroes **all** transitions and animations, including opacity/color feedback that aids comprehension.

```css
/* apps/web/src/styles/global.css:51-58 — current */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Per AUDIT.md: reduced motion means fewer and gentler animations, not zero — drop position changes, keep helpful opacity/color transitions.

Decorative loops (`livepulse` on `.live` badges) should stop entirely under reduced motion.

## Target

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  /* Drop movement; keep short opacity/color for state comprehension */
  * {
    scroll-behavior: auto !important;
  }

  @supports (transition: opacity 1ms) {
    * {
      transition-property: opacity, color, background-color, border-color, box-shadow !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

Alternative simpler approach if `@supports` feels heavy: scope the nuclear `transition-duration: 0.01ms` to `transition-property: transform` only via a custom property override — pick one approach and document in a comment.

Also add:

```css
@media (prefers-reduced-motion: reduce) {
  .livepulse,
  [class*="live"] {
    animation: none !important;
  }
}
```

(Adjust selector if too broad after testing — `EventRow` uses `.live` class and `animation: livepulse`.)

## Repo conventions to follow

- `livepulse` keyframes defined in `global.css:41-48`.
- `EventRow.module.css:190` and `SecHead.module.css:82` use `livepulse`.

## Steps

1. Edit `apps/web/src/styles/global.css` reduced-motion block per **Target**.
2. Explicitly disable `livepulse` on `.live` elements (grep `livepulse` in `apps/web/src` to confirm selectors).
3. Verify hover `transform` on rows/cards does not animate when reduced motion is on (transform transitions should still be instant).

## Boundaries

- Do NOT remove the `livepulse` keyframe definition (used when motion is allowed).
- Do NOT add JS `useReducedMotion` hooks in this plan.

## Verification

- **Mechanical**: typecheck + existing tests pass.
- **Feel check**: Chrome DevTools → Rendering → `prefers-reduced-motion: reduce`. Live badges should not pulse. Event row hover should jump instantly (no translate animation). Button hover color may still flash if you kept opacity/color transitions — confirm it's subtle, not nauseating.
- **Done when**: No infinite animations run under reduced motion; transform hovers are instant.
