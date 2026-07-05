import { Link } from "@tanstack/react-router";

import { PageChrome } from "@/components/PageChrome";
import { Text } from "@/components/Text";
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
        <Text variant="eyebrow" tone="label" className={styles.eyebrow}>
          {eyebrow}
        </Text>
        <Text variant="header1" tone="onPage" as="h1">
          {title}
        </Text>
        <Text variant="body1" tone="mutedOnPage" className={styles.desc}>
          {description}
        </Text>
        {actions.length > 0 ? (
          <div className={styles.actions}>
            {actions.map((action) => (
              <Text key={action} variant="eyebrow" tone="onPage" as="span">
                {action}
              </Text>
            ))}
          </div>
        ) : null}
        <Link to="/" className={styles.home}>
          <Text variant="body2" tone="accent" as="span">
            ← Back to events
          </Text>
        </Link>
      </section>
    </PageChrome>
  );
}
