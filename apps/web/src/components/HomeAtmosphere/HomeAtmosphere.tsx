import { useEffect, useState } from "react";

import {
  ATMOSPHERE_MOBILE_MAX_WIDTH_PX,
  HOME_ATMOSPHERE,
  isMobileAtmosphereViewport,
  pickAtmosphereVariant,
  resolveAtmosphereUrl
} from "@/lib/home-atmosphere";

import styles from "./HomeAtmosphere.module.css";

function readIsMobileViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return isMobileAtmosphereViewport(window.innerWidth, ATMOSPHERE_MOBILE_MAX_WIDTH_PX);
}

/** Fixed veiled landscape behind page content. No-op when HOME_ATMOSPHERE is "none". */
export function HomeAtmosphere() {
  // Pick once per mount (full reload). Avoid Math.random during render for Strict Mode double-invoke
  // by storing in state initializer.
  const [variant] = useState(() => pickAtmosphereVariant());
  const [isMobile, setIsMobile] = useState(readIsMobileViewport);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${ATMOSPHERE_MOBILE_MAX_WIDTH_PX}px)`);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (HOME_ATMOSPHERE === "none") {
    return null;
  }

  const imageUrl = resolveAtmosphereUrl(variant, { isMobile });

  return (
    <div className={styles.root} aria-hidden data-testid="home-atmosphere" data-atmosphere={HOME_ATMOSPHERE}>
      <div
        className={styles.photo}
        style={{ backgroundImage: `url(${imageUrl})` }}
        data-atmosphere-image={imageUrl}
        data-atmosphere-id={variant.id}
      />
      <div className={styles.veil} />
      <div className={styles.halftone} />
    </div>
  );
}
