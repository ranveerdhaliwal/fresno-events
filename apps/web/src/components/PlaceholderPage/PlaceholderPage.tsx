import { Link } from "@tanstack/react-router";

import { PageChrome } from "@/components/PageChrome";
import { useSeoHead } from "@/lib/seo/useSeoHead";
import { buildNoIndexSeo } from "@/lib/seo/page-seo";

import styles from "./PlaceholderPage.module.css";

export interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
  canonicalPath: string;
  actions?: string[];
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  canonicalPath,
  actions = []
}: PlaceholderPageProps) {
  useSeoHead(buildNoIndexSeo(title, description, canonicalPath));

  return (
    <PageChrome>
    <section className={styles.card} data-testid="placeholder-page">
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p className={styles.desc}>{description}</p>
      {actions.length > 0 ? (
        <div className={styles.actions}>
          {actions.map((action) => (
            <span key={action}>{action}</span>
          ))}
        </div>
      ) : null}
      <Link to="/" className={styles.home}>
        ← Back to events
      </Link>
    </section>
    </PageChrome>
  );
}
