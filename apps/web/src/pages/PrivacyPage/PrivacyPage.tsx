import { PageChrome } from "@/components/PageChrome";

import styles from "./PrivacyPage.module.css";

export function PrivacyPage() {
  return (
    <PageChrome mobileNav={{ variant: "day", title: "PRIVACY" }}>
      <article className={styles.article}>
        <h1>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: June 2026</p>

        <p>
          What Up Fresno (&ldquo;we,&rdquo; &ldquo;us&rdquo;) operates whatupfresno.com to help people discover events in
          Fresno and the Central Valley. This policy explains what information we collect and how we use third-party
          services on the site.
        </p>

        <h2>Information we collect</h2>
        <p>
          When you browse the site, we may collect standard usage data through <strong>Google Analytics</strong>, including
          pages viewed, approximate location (city/region), device and browser type, and referral source. Google Analytics
          uses cookies and similar technologies. You can learn more in{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google&apos;s Privacy Policy
          </a>
          .
        </p>

        <h2>Advertising</h2>
        <p>
          We use <strong>Google AdSense</strong> to show ads. Google and its partners may use cookies to serve ads based
          on your visits to this site and other sites. You can manage ad personalization in{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">
            Google Ads Settings
          </a>
          .
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell your personal information.</li>
          <li>We do not require an account to browse public event listings.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions about this policy? Email{" "}
          <a href="mailto:hello@whatupfresno.com">hello@whatupfresno.com</a>.
        </p>
      </article>
    </PageChrome>
  );
}
