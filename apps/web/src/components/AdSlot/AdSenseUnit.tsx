import { useEffect, useRef } from "react";

import { loadAdSenseScript, pushAdSenseSlot } from "@/lib/google-adsense/google-adsense.utils";

import styles from "./AdSlot.module.css";

export interface AdSenseUnitProps {
  clientId: string;
  slotId: string;
  variant: "banner-wide" | "banner-stacked" | "card" | "side";
}

export function AdSenseUnit({ clientId, slotId, variant }: AdSenseUnitProps) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) {
      return;
    }

    let cancelled = false;

    void loadAdSenseScript(clientId).then(() => {
      if (cancelled || pushedRef.current) {
        return;
      }
      pushAdSenseSlot();
      pushedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, slotId]);

  return (
    <div className={styles.live} data-testid={`ad-slot-live-${variant}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
