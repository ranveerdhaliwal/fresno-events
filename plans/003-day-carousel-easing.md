# 003 — Tighten day carousel slide easing

- **Status**: TODO
- **Commit**: 2ba66d7
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 2 lines

## Problem

`DayDateCarousel` uses a 360ms transition with a weak default-like cubic-bezier. UI animations should stay under 300ms with a strong ease-out for responsive feel.

```css
/* apps/web/src/components/DayDateCarousel/DayDateCarousel.module.css:20-22 — current */
.trackAnimated {
  transition: transform 360ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

Swipe/arrows trigger this on every date shift — tens of times per session.

## Target

```css
.trackAnimated {
  transition: transform var(--duration-panel) var(--ease-out);
}
```

Where `--duration-panel: 250ms` and `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` come from plan **001**.

## Repo conventions to follow

- Carousel already uses `translate3d` and `will-change: transform` on `.track` — keep GPU-friendly transform only.
- `transitionEnabled` gating in `DayDateCarousel.tsx` must remain untouched.

## Steps

1. Ensure plan **001** is applied.
2. Replace `.trackAnimated` transition in `DayDateCarousel.module.css` with the **Target** rule.

## Boundaries

- Do NOT change swipe threshold (48px) or `translate3d` logic in the TSX file.
- Do NOT switch to keyframe animations (interruptibility: rapid swipes need transition retargeting).

## Verification

- **Mechanical**: typecheck passes.
- **Feel check**: Home page → swipe day strip or use arrows. Slide should complete in ~250ms, snappy start (ease-out). Spam arrow clicks — each slide should retarget smoothly without restarting from zero. DevTools Animations panel at 25% speed to confirm curve.
- **Done when**: Computed transition duration is 250ms and easing matches `--ease-out`.
