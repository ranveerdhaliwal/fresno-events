import { useState } from "react";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  ATMOSPHERE_MOBILE_MAX_WIDTH_PX,
  HOME_ATMOSPHERE,
  pickAtmosphereVariant,
  resolveAtmosphereUrl
} from "@/lib/home-atmosphere";

import styles from "./HomeAtmosphere.module.css";

/** Fixed veiled landscape behind page content. No-op when HOME_ATMOSPHERE is "none". */
export function HomeAtmosphere() {
  // Pick once per mount (full reload). Avoid Math.random during render for Strict Mode double-invoke
  // by storing in state initializer.
  const [variant] = useState(() => pickAtmosphereVariant());
  const isMobile = useMediaQuery(`(max-width: ${ATMOSPHERE_MOBILE_MAX_WIDTH_PX}px)`);

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
