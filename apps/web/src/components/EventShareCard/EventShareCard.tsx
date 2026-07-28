import { Link2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/Button/Button";
import { Text } from "@/components/Text";
import { CENTRAL_VALLEY_GREETING } from "@/lib/section-script.utils";

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
      <Text variant="eyebrow" tone="labelOnCard" as="h3">
        SHARE
      </Text>
      <Text variant="script" tone="accent" scriptStyle="footer" as="p" className={styles.script}>
        {CENTRAL_VALLEY_GREETING}
      </Text>
      <Text variant="body2" tone="mutedOnCard" as="p" className={styles.hint}>
        Share this event with friends across Fresno.
      </Text>
      <div className={styles.buttons}>
        <Button type="button" variant="mustard" size="xs" onClick={() => void copyLink()}>
          <Link2 size={14} aria-hidden />
          {copied ? "Copied!" : "Copy link"}
        </Button>
        <Button href={shareUrls.twitter} target="_blank" rel="noreferrer" variant="mustard" size="xs">
          X
        </Button>
        <Button href={shareUrls.facebook} target="_blank" rel="noreferrer" variant="mustard" size="xs">
          Facebook
        </Button>
        <Button href={shareUrls.sms} variant="mustard" size="xs">
          Text
        </Button>
      </div>
    </div>
  );
}
