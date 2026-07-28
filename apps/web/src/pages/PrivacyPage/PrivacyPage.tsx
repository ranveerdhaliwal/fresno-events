import { PageChrome } from "@/components/PageChrome";
import { Text } from "@/components/Text";
import { buildPrivacySeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";

import styles from "./PrivacyPage.module.css";

export function PrivacyPage() {
  useSeoHead(buildPrivacySeo());

  return (
    <PageChrome mobileNav={{ variant: "day", title: "PRIVACY" }}>
      <article className={styles.article}>
        <Text variant="header1" tone="onPage" stroke="onDark" as="h1">
          Privacy Policy
        </Text>
        <Text variant="body3" tone="label" as="p" className={styles.updated}>
          Last updated: June 2026
        </Text>

        <Text variant="body1" tone="onPage" as="p">
          What Up Fresno (&ldquo;we,&rdquo; &ldquo;us&rdquo;) operates whatupfresno.com to help people discover events in
          Fresno and the Central Valley. This policy explains what information we collect and how we use third-party
          services on the site.
        </Text>

        <Text variant="header2" tone="onPage" as="h2">
          Information we collect
        </Text>
        <Text variant="body1" tone="onPage" as="p">
          When you browse the site, we may collect standard usage data through <strong>Google Analytics</strong>, including
          pages viewed, approximate location (city/region), device and browser type, and referral source. Google Analytics
          uses cookies and similar technologies. You can learn more in{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google&apos;s Privacy Policy
          </a>
          .
        </Text>

        <Text variant="header2" tone="onPage" as="h2">
          Advertising
        </Text>
        <Text variant="body1" tone="onPage" as="p">
          We use <strong>Google AdSense</strong> to show ads. Google and its partners may use cookies to serve ads based
          on your visits to this site and other sites. You can manage ad personalization in{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">
            Google Ads Settings
          </a>
          .
        </Text>

        <Text variant="header2" tone="onPage" as="h2">
          What we do not do
        </Text>
        <ul>
          <li>
            <Text variant="body1" tone="onPage" as="span">
              We do not sell your personal information.
            </Text>
          </li>
          <li>
            <Text variant="body1" tone="onPage" as="span">
              We do not require an account to browse public event listings.
            </Text>
          </li>
        </ul>

        <Text variant="header2" tone="onPage" as="h2">
          Contact
        </Text>
        <Text variant="body1" tone="onPage" as="p">
          Questions about this policy? Email{" "}
          <a href="mailto:hello@whatupfresno.com">hello@whatupfresno.com</a>.
        </Text>
      </article>
    </PageChrome>
  );
}
