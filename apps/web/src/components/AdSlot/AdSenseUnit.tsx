import { useEffect, useRef } from "react";

import { loadAdSenseScript, pushAdSenseSlot } from "@/lib/google-adsense/google-adsense.utils";

import type { AdSlotVariant } from "./AdSlot";
import styles from "./AdSlot.module.css";

export interface AdSenseUnitProps {
  clientId: string;
  slotId: string;
  variant: AdSlotVariant;
  /**
   * Fired when no ad will appear in this slot: AdSense reported `unfilled`
   * (no inventory for this impression) or the script never loaded (ad blocker,
   * CSP). Lets the caller fall back to the house placeholder instead of
   * leaving reserved empty space on the page.
   */
  onUnavailable?: () => void;
}

export function AdSenseUnit({ clientId, slotId, variant, onUnavailable }: AdSenseUnitProps) {
  const pushedRef = useRef(false);
  const insRef = useRef<HTMLModElement>(null);
  // Kept in a ref so an inline callback prop cannot restart the effects below.
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    if (pushedRef.current) {
      return;
    }

    let cancelled = false;

    void loadAdSenseScript(clientId)
      .then(() => {
        if (cancelled || pushedRef.current) {
          return;
        }
        pushAdSenseSlot();
        pushedRef.current = true;
      })
      .catch(() => {
        // Blocked or failed to load — there will never be an ad here.
        if (!cancelled) {
          onUnavailableRef.current?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, slotId]);

  // AdSense stamps data-ad-status on the <ins> once it resolves the request:
  // "filled" when an ad rendered, "unfilled" when it had nothing to serve.
  useEffect(() => {
    const el = insRef.current;
    if (!el) {
      return;
    }

    const resolved = () => {
      const status = el.getAttribute("data-ad-status");
      if (status === "unfilled") {
        onUnavailableRef.current?.();
        return true;
      }
      return status === "filled";
    };

    if (resolved()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (resolved()) {
        observer.disconnect();
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.live} data-variant={variant} data-testid={`ad-slot-live-${variant}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
