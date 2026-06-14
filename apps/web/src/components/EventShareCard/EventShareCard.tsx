import { Link2 } from "lucide-react";
import { useState } from "react";

import styles from "./EventShareCard.module.css";

export interface EventShareCardProps {
  title: string;
  url: string;
}

export function EventShareCard({ title, url }: EventShareCardProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.card} data-testid="event-share-card">
      <h3>SHARE</h3>
      <p className={styles.script}>greetings from the central valley</p>
      <p className={styles.hint}>Share this event with friends across Fresno.</p>
      <div className={styles.buttons}>
        <button type="button" className={styles.btn} onClick={() => void copyLink()}>
          <Link2 size={14} aria-hidden />
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a
          className={styles.btn}
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noreferrer"
        >
          X
        </a>
        <a
          className={styles.btn}
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
        >
          Facebook
        </a>
        <a
          className={styles.btn}
          href={`sms:?&body=${encodedTitle}%20${encodedUrl}`}
        >
          Text
        </a>
      </div>
    </div>
  );
}
