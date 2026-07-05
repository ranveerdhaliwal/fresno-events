import { useEffect } from "react";

import {
  buildOgTags,
  buildRobotsContent,
  buildTwitterTags,
  canonicalUrl,
  type SeoHeadInput
} from "@fresno-events/shared";

const MANAGED_SELECTOR = "[data-seo-managed]";
const JSON_LD_ID = "seo-json-ld";

const DEFAULT_TITLE = "What Up Fresno";
const DEFAULT_DESCRIPTION =
  "What Up Fresno is building one place to find concerts, festivals, food, art, sports, and community events across Fresno and the Central Valley.";

function upsertMeta(attribute: "name" | "property", key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    element.setAttribute("data-seo-managed", "true");
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertLink(rel: string, href: string): void {
  const selector = `link[rel="${rel}"]`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    element.setAttribute("data-seo-managed", "true");
    document.head.appendChild(element);
  }
  element.href = href;
}

function removeManagedMeta(attribute: "name" | "property", key: string): void {
  document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"][data-seo-managed="true"]`)?.remove();
}

function removeManagedLink(rel: string): void {
  document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-seo-managed="true"]`)?.remove();
}

function upsertJsonLd(jsonLd: Record<string, unknown> | Record<string, unknown>[] | undefined): void {
  const existing = document.getElementById(JSON_LD_ID);
  if (!jsonLd) {
    existing?.remove();
    return;
  }

  const script = (existing ?? document.createElement("script")) as HTMLScriptElement;
  script.id = JSON_LD_ID;
  script.type = "application/ld+json";
  script.setAttribute("data-seo-managed", "true");
  script.textContent = JSON.stringify(jsonLd);
  if (!existing) {
    document.head.appendChild(script);
  }
}

function clearManagedHead(): void {
  document.querySelectorAll(MANAGED_SELECTOR).forEach((node) => node.remove());
  document.title = DEFAULT_TITLE;
  const description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) {
    description.content = DEFAULT_DESCRIPTION;
  }
}

function applySeoHead(input: SeoHeadInput): void {
  document.title = input.title;

  upsertMeta("name", "description", input.description);

  const robots = buildRobotsContent(Boolean(input.noindex));
  if (robots) {
    upsertMeta("name", "robots", robots);
  } else {
    removeManagedMeta("name", "robots");
  }

  upsertLink("canonical", canonicalUrl(input.canonicalPath));

  const ogImageUrl = input.ogImageUrl ?? null;
  const og = buildOgTags({
    title: input.title,
    description: input.description,
    canonicalPath: input.canonicalPath,
    ogImageUrl,
    ...(input.ogType ? { type: input.ogType } : {})
  });
  upsertMeta("property", "og:title", og.title);
  upsertMeta("property", "og:description", og.description);
  upsertMeta("property", "og:url", og.url);
  upsertMeta("property", "og:image", og.image);
  upsertMeta("property", "og:type", og.type);
  upsertMeta("property", "og:site_name", "What Up Fresno");

  const twitter = buildTwitterTags({
    title: input.title,
    description: input.description,
    ogImageUrl
  });
  upsertMeta("name", "twitter:card", twitter.card);
  upsertMeta("name", "twitter:title", twitter.title);
  upsertMeta("name", "twitter:description", twitter.description);
  upsertMeta("name", "twitter:image", twitter.image);

  upsertJsonLd(input.jsonLd);
}

export function useSeoHead(input: SeoHeadInput | null | undefined): void {
  const serialized = input ? JSON.stringify(input) : null;

  useEffect(() => {
    if (!serialized) {
      return;
    }
    applySeoHead(JSON.parse(serialized) as SeoHeadInput);
    return () => {
      clearManagedHead();
    };
  }, [serialized]);
}
