import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import {
  ATMOSPHERE_MOBILE_MAX_WIDTH_PX,
  HOME_ATMOSPHERE,
  pickAtmosphereVariant,
  pickAtmosphereVariantExcluding,
  resolveAtmosphereUrl,
  type AtmosphereImageVariant
} from "@/lib/home-atmosphere";

import styles from "./HomeAtmosphere.module.css";

const FADE_MS = 800;

interface AtmosphereLayer {
  variant: AtmosphereImageVariant;
  key: number;
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

/** Fixed veiled landscape behind page content. Crossfades on route changes. */
export function HomeAtmosphere() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isMobile = useMediaQuery(`(max-width: ${ATMOSPHERE_MOBILE_MAX_WIDTH_PX}px)`);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [base, setBase] = useState<AtmosphereLayer>(() => ({
    variant: pickAtmosphereVariant(),
    key: 0
  }));
  const [overlay, setOverlay] = useState<(AtmosphereLayer & { visible: boolean }) | null>(null);
  const baseRef = useRef(base);
  const isMobileRef = useRef(isMobile);
  const reduceMotionRef = useRef(reduceMotion);
  const skipPathEffect = useRef(true);
  const fadeGen = useRef(0);

  baseRef.current = base;
  isMobileRef.current = isMobile;
  reduceMotionRef.current = reduceMotion;

  useEffect(() => {
    if (skipPathEffect.current) {
      skipPathEffect.current = false;
      return;
    }

    const previous = baseRef.current;
    const nextVariant = pickAtmosphereVariantExcluding(previous.variant.id);
    if (nextVariant.id === previous.variant.id) {
      return;
    }

    if (reduceMotionRef.current) {
      setOverlay(null);
      setBase({ variant: nextVariant, key: previous.key + 1 });
      return;
    }

    const generation = fadeGen.current + 1;
    fadeGen.current = generation;
    const nextKey = previous.key + 1;
    const nextUrl = resolveAtmosphereUrl(nextVariant, { isMobile: isMobileRef.current });

    let cancelled = false;
    setOverlay({ variant: nextVariant, key: nextKey, visible: false });

    void preloadImage(nextUrl).then(() => {
      if (cancelled || fadeGen.current !== generation) return;
      // Double rAF so the browser paints opacity:0 before fading in.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled || fadeGen.current !== generation) return;
          setOverlay((current) =>
            current && current.key === nextKey ? { ...current, visible: true } : current
          );
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (HOME_ATMOSPHERE === "none") {
    return null;
  }

  const baseUrl = resolveAtmosphereUrl(base.variant, { isMobile });
  const overlayUrl = overlay ? resolveAtmosphereUrl(overlay.variant, { isMobile }) : null;

  return (
    <div className={styles.root} aria-hidden data-testid="home-atmosphere" data-atmosphere={HOME_ATMOSPHERE}>
      <div className={styles.photos} data-testid="home-atmosphere-photos">
        <div
          className={styles.photo}
          style={{ backgroundImage: `url(${baseUrl})` }}
          data-atmosphere-image={baseUrl}
          data-atmosphere-id={base.variant.id}
          data-atmosphere-layer="base"
        />
        {overlay && overlayUrl ? (
          <div
            className={cn(styles.photo, styles.photoOverlay, overlay.visible && styles.photoVisible)}
            style={{
              backgroundImage: `url(${overlayUrl})`,
              transitionDuration: `${FADE_MS}ms`
            }}
            data-atmosphere-image={overlayUrl}
            data-atmosphere-id={overlay.variant.id}
            data-atmosphere-layer="overlay"
            onTransitionEnd={(event) => {
              if (event.propertyName !== "opacity" || !overlay.visible) return;
              setBase({ variant: overlay.variant, key: overlay.key });
              setOverlay(null);
            }}
          />
        ) : null}
      </div>
      <div className={styles.veil} />
      <div className={styles.halftone} />
    </div>
  );
}
