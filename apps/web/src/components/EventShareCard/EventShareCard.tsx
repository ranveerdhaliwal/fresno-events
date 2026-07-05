import { Link2 } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/Text";

import { buildEventShareUrls, copyTextToClipboard } from "./EventShareCard.utils";
import styles from "./EventShareCard.module.css";

export interface EventShareCardProps {
  title: string;
  url: string;
}

export function EventShareCard({ title, url }: EventShareCardProps) {
  const [copied, setCopied] = useState(false);
  const shareUrls = buildEventShareUrls(title, url);

  const copyLink = async () => {
    const ok = await copyTextToClipboard(url);
    if (!ok) {
      setCopied(false);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.card} data-testid="event-share-card">
      <Text variant="eyebrow" tone="onCard" as="h3">
        SHARE
      </Text>
      <Text variant="script" tone="accent" scriptStyle="footer" as="p" className={styles.script}>
        greetings from the central valley
      </Text>
      <Text variant="body2" tone="mutedOnCard" as="p" className={styles.hint}>
        Share this event with friends across Fresno.
      </Text>
      <div className={styles.buttons}>
        <button type="button" className={styles.btn} onClick={() => void copyLink()}>
          <Link2 size={14} aria-hidden />
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a className={styles.btn} href={shareUrls.twitter} target="_blank" rel="noreferrer">
          X
        </a>
        <a className={styles.btn} href={shareUrls.facebook} target="_blank" rel="noreferrer">
          Facebook
        </a>
        <a className={styles.btn} href={shareUrls.sms}>
          Text
        </a>
      </div>
    </div>
  );
}
