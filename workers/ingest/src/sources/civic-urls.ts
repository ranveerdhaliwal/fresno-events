/**
 * Venue URLs for ai-discovery (legacy HTML + LLM).
 * Avoid URLs already covered by API scrapers or ai-crawl seed_urls.
 */
export const civicDiscoveryUrls = [
  { url: "https://www.cityoffresno.gov/parks/events/", label: "City of Fresno Parks" },
  { url: "https://www.valhallabar.com/events", label: "Valhalla" }
] as const;
