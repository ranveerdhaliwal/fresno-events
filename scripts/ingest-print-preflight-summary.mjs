#!/usr/bin/env node
/**
 * Print ingest health + persist summary from a /trigger JSON response (preflight or promote).
 * Usage: curl ... | node scripts/ingest-print-preflight-summary.mjs
 * Exits 1 when any source health is FAIL or promote did not persist.
 */

import { readFileSync } from "node:fs";

const PST = "America/Los_Angeles";
const TITLE_MAX = 34;
const URL_LABEL_MAX = 30;

/** @param {string} text @param {number} max */
function truncateEnd(text, max) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

/** Path only (no domain) for compact terminal display; full URL stays in OSC 8 target. */
/** @param {string} url @param {number} [maxLen] */
function shortUrlPath(url, maxLen = URL_LABEL_MAX) {
  try {
    const u = new URL(url);
    let path = u.pathname || "/";
    if (u.search) {
      path += u.search;
    }
    try {
      path = decodeURI(path);
    } catch {
      /* keep encoded */
    }
    return truncateEnd(path, maxLen);
  } catch {
    return truncateEnd(url, maxLen);
  }
}

/** Full URL in OSC 8 target; visible text can be shorter. */
/** @param {string} url @param {string} label */
function terminalLink(url, label) {
  const safe = url.trim();
  if (!safe.startsWith("http")) {
    return label;
  }
  if (process.env.NO_HYPERLINK === "1" || !process.stdout.isTTY) {
    return label;
  }
  return `\u001b]8;;${safe}\u0007${label}\u001b]8;;\u0007`;
}

/** @param {string | undefined} iso */
function formatPstShort(iso) {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PST,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const meridiem = get("dayPeriod").toLowerCase().startsWith("p") ? "p" : "a";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}${meridiem}`;
}

const input = readFileSync(0, "utf8").trim();
if (!input) {
  process.exit(0);
}

/** @type {unknown} */
let body;
try {
  body = JSON.parse(input);
} catch {
  console.error("Preflight: invalid JSON response from ingest worker.");
  process.exit(1);
}

if (
  typeof body !== "object" ||
  body === null ||
  !("data" in body) ||
  typeof body.data !== "object" ||
  body.data === null ||
  !("summaries" in body.data) ||
  !Array.isArray(body.data.summaries)
) {
  console.error("Preflight: unexpected response shape.");
  process.exit(1);
}

/** @typedef {{ title?: string, url?: string, start_ts?: string }} EventLink */
/** @typedef {{ url?: string, label?: string, events_found?: number, venue_key?: string, event_source?: string, detail_urls_planned?: number, dry_run_plan?: boolean, listing_urls?: string[], detail_urls?: string[], event_links?: EventLink[] }} SeedMetric */
/** @typedef {{ url?: string, message?: string }} ScrapeError */
/** @typedef {{ code?: string, message?: string }} ValidationIssue */
/** @typedef {{ source?: string, title?: string, start_ts?: string, external_url?: string, source_event_id?: string, changed_fields?: string[] }} AuditItem */

/** @typedef {{ key: string, label: string, url: string, eventSource: string | null, eventsFound: number, errors: ScrapeError[], soft: ValidationIssue[], status: "OK" | "WARN" | "FAIL", detail: string | null }} SourceHealth */

const STALE_VALIDATION_PATTERN = /errors=\d+ exceeds maxErrors=/;

/** @param {unknown} summary */
function isStaleValidationSummary(summary) {
  if (!isRecord(summary) || !isRecord(summary.validation) || !Array.isArray(summary.validation.hard)) {
    return false;
  }
  return summary.validation.hard.some(
    (issue) => isRecord(issue) && typeof issue.message === "string" && STALE_VALIDATION_PATTERN.test(issue.message)
  );
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === "object" && value !== null;
}

/** @param {string} url */
function titleFromUrl(url) {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "event";
    return slug.replace(/-/g, " ");
  } catch {
    return url;
  }
}

/** @param {AuditItem | EventLink} item */
function resolveEventUrl(item) {
  if ("url" in item && typeof item.url === "string" && item.url.startsWith("http")) {
    return item.url;
  }
  if ("external_url" in item && typeof item.external_url === "string" && item.external_url.startsWith("http")) {
    return item.external_url;
  }
  if (
    "source_event_id" in item &&
    typeof item.source_event_id === "string" &&
    item.source_event_id.startsWith("http")
  ) {
    return item.source_event_id;
  }
  return "";
}

/** @param {{ title?: string, url?: string, start_ts?: string }} row */
function printEventLine(row) {
  const title = truncateEnd(row.title?.trim() || "(untitled)", TITLE_MAX);
  const url = resolveEventUrl(row);
  const when = formatPstShort(row.start_ts);
  if (url) {
    const link = terminalLink(url, shortUrlPath(url));
    console.log(`  ${title} - ${link}${when ? ` - ${when}` : ""}`);
  } else {
    console.log(`  ${title}${when ? ` - ${when}` : ""}`);
  }
}

/** @param {SeedMetric} metric @param {AuditItem[]} newItems */
function collectVenueEvents(metric, newItems) {
  /** @type {{ title: string, url: string, start_ts?: string }[]} */
  const rows = [];
  const source = metric.event_source ?? null;

  for (const link of metric.event_links ?? []) {
    rows.push({
      title: link.title?.trim() || titleFromUrl(link.url ?? ""),
      url: link.url?.trim() ?? "",
      ...(link.start_ts ? { start_ts: link.start_ts } : {})
    });
  }

  if (rows.length === 0) {
    for (const item of newItems) {
      if (source && item.source !== source) {
        continue;
      }
      rows.push({
        title: item.title?.trim() || "(untitled)",
        url: resolveEventUrl(item),
        ...(item.start_ts ? { start_ts: item.start_ts } : {})
      });
    }
  } else {
    const byTitle = new Map(
      newItems
        .filter((item) => !source || item.source === source)
        .map((item) => [item.title?.trim() ?? "", item])
    );
    for (const row of rows) {
      const audit = byTitle.get(row.title);
      if (!row.start_ts && audit?.start_ts) {
        row.start_ts = audit.start_ts;
      }
      if (!row.url) {
        row.url = resolveEventUrl(audit ?? {});
      }
    }
  }

  if (rows.length === 0) {
    for (const url of metric.detail_urls ?? []) {
      if (!url.startsWith("http")) {
        continue;
      }
      rows.push({ title: titleFromUrl(url), url });
    }
  }

  rows.sort((a, b) => {
    if (!a.start_ts && !b.start_ts) {
      return a.title.localeCompare(b.title);
    }
    if (!a.start_ts) {
      return 1;
    }
    if (!b.start_ts) {
      return -1;
    }
    return new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime();
  });

  return { rows };
}

/** @param {SeedMetric[]} metrics @param {{ new: number, changed: number, unchanged: number, new_items: AuditItem[], changed_items: AuditItem[] }} merged */
function printPreflightEventSummary(metrics, merged) {
  const browserDryRunOnly =
    metrics.length > 0 &&
    metrics.every((m) => m.dry_run_plan === true && (m.event_links?.length ?? 0) === 0);

  if (merged.new === 0 && merged.changed === 0 && merged.unchanged === 0 && metrics.length === 0) {
    console.log("=== Preflight persist preview ===");
    console.log("Unavailable (no Supabase config or zero scraped events).");
    return;
  }

  console.log("=== Preflight summary (no DB writes) ===");
  if (merged.new > 0 || merged.changed > 0 || merged.unchanged > 0) {
    console.log(`+${merged.new} new  ~${merged.changed} changed  =${merged.unchanged} unchanged`);
  }
  if (browserDryRunOnly && merged.new === 0) {
    console.log("(Browser venues: listing + detail URLs below; full parse on promote.)");
  }
  console.log("");

  for (const metric of metrics) {
    const key = metric.venue_key ?? metric.label ?? "venue";
    const count = typeof metric.events_found === "number" ? metric.events_found : 0;
    const source = metric.event_source ? ` · ${metric.event_source}` : "";
    const listing = (metric.listing_urls?.[0] ?? metric.url ?? "").trim();

    console.log(`${key} (${count} events)${source}`);
    if (listing.startsWith("http")) {
      console.log(`  listing - ${terminalLink(listing, shortUrlPath(listing))}`);
    }

    const { rows } = collectVenueEvents(metric, merged.new_items);
    for (const row of rows) {
      printEventLine(row);
    }

    console.log("");
  }

  if (merged.changed_items.length > 0) {
    console.log("Changed:");
    for (const item of merged.changed_items) {
      const fields = Array.isArray(item.changed_fields) ? item.changed_fields.join(", ") : "?";
      printEventLine({
        title: item.title,
        url: resolveEventUrl(item),
        start_ts: item.start_ts
      });
      console.log(`  (${fields})`);
    }
    console.log("");
  }
}

/** @param {SeedMetric} metric @param {ScrapeError[]} errors @param {ValidationIssue[]} softIssues @returns {SourceHealth} */
function healthFromSeedMetric(metric, errors, softIssues) {
  const key = metric.venue_key ?? metric.label ?? metric.url ?? "unknown";
  const label = metric.label ?? key;
  const url = metric.url ?? "";
  const eventSource = metric.event_source ?? null;
  const eventsFound = typeof metric.events_found === "number" ? metric.events_found : 0;
  const detailUrlsPlanned =
    typeof metric.detail_urls_planned === "number" ? metric.detail_urls_planned : eventsFound;
  const dryRunPlan = metric.dry_run_plan === true;
  const matchedErrors = errorsForUrl(errors, url);

  const soft = softIssues.filter((issue) => {
    const message = issue.message ?? "";
    if (eventSource && message.includes(eventSource)) {
      return true;
    }
    return url && message.toLowerCase().includes(hostname(url));
  });

  let status = /** @type {"OK" | "WARN" | "FAIL"} */ ("OK");
  let detail = null;

  if (eventsFound === 0 && matchedErrors.length > 0) {
    status = "FAIL";
    detail = formatErrors(matchedErrors);
  } else if (eventsFound === 0 && detailUrlsPlanned > 0 && dryRunPlan) {
    status = "OK";
    detail = `${detailUrlsPlanned} detail URL(s) on promote`;
  } else if (eventsFound === 0) {
    status = "FAIL";
    detail =
      soft.length > 0
        ? soft.map((issue) => issue.message).filter(Boolean).join("; ")
        : dryRunPlan || eventSource
          ? "No events returned"
          : "No events — check BR/LLM in .dev.vars";
  } else if (soft.length > 0) {
    status = "WARN";
    detail = soft.map((issue) => issue.message).filter(Boolean).join("; ");
  }

  return { key, label, url, eventSource, eventsFound, errors: matchedErrors, soft, status, detail };
}

/** @param {unknown} summary @returns {SourceHealth[]} */
function collectSourceHealth(summary) {
  if (!isRecord(summary)) {
    return [];
  }

  const errors = Array.isArray(summary.scrape_errors) ? summary.scrape_errors : [];
  const soft = isRecord(summary.validation) && Array.isArray(summary.validation.soft) ? summary.validation.soft : [];
  const seedMetrics = Array.isArray(summary.seed_metrics) ? summary.seed_metrics : [];

  if (seedMetrics.length > 0) {
    return seedMetrics.map((metric) => healthFromSeedMetric(/** @type {SeedMetric} */ (metric), errors, soft));
  }

  const source = typeof summary.source === "string" ? summary.source : "unknown";
  const eventsFound = typeof summary.events_found === "number" ? summary.events_found : 0;
  const ok = summary.ok === true;
  const validationOk = isRecord(summary.validation) ? summary.validation.ok === true : true;
  const hard = isRecord(summary.validation) && Array.isArray(summary.validation.hard) ? summary.validation.hard : [];

  let status = /** @type {"OK" | "WARN" | "FAIL"} */ ("OK");
  let detail = null;

  if (!ok || !validationOk || hard.length > 0) {
    status = "FAIL";
    detail = hard.map((issue) => issue.message).filter(Boolean).join("; ") || "Validation failed";
  } else if (eventsFound === 0 && errors.length > 0) {
    status = "FAIL";
    detail = formatErrors(errors);
  } else if (eventsFound === 0) {
    status = "FAIL";
    detail = "No events returned";
  } else if (soft.length > 0) {
    status = "WARN";
    detail = soft.map((issue) => issue.message).filter(Boolean).join("; ");
  }

  return [
    {
      key: source,
      label: source,
      url: "",
      eventSource: null,
      eventsFound,
      errors,
      soft,
      status,
      detail
    }
  ];
}

/** @param {string} url */
function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^www\./, "");
  }
}

/** @param {string} url */
function domainStem(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0] ?? "";
  } catch {
    return url.replace(/^www\./, "").split(".")[0] ?? "";
  }
}

/** @param {ScrapeError[]} errors @param {string} url */
function errorsForUrl(errors, url) {
  if (!url) {
    return errors;
  }
  const stem = domainStem(url);
  return errors.filter((error) => error.url && domainStem(error.url) === stem);
}

/** @param {ScrapeError[]} errors */
function formatErrors(errors) {
  const first = errors[0];
  if (!first) {
    return "Request errors";
  }
  const count = errors.length;
  const message = first.message ?? "error";
  const url = first.url ? ` — ${first.url}` : "";
  return count > 1 ? `${message} (${count} errors)${url}` : `${message}${url}`;
}

/** @type {SourceHealth[]} */
const healthRows = [];
for (const summary of body.data.summaries) {
  healthRows.push(...collectSourceHealth(summary));
}

const isPromote = body.data.summaries.some(
  (summary) => isRecord(summary) && summary.dry_run !== true && "persistence" in summary
);

const staleWorker = body.data.summaries.some((summary) => isStaleValidationSummary(summary));
if (staleWorker) {
  console.error("");
  console.error("Stale ingest worker — validation fix not loaded.");
  console.error("Stop and restart: pnpm ingest:dev");
  console.error("(Expected validation_policy: recoverable_errors_soft_v2 on GET /health)");
  console.error("");
}

console.log("");
console.log(isPromote ? "=== Promote source health ===" : "=== Preflight source health ===");
for (const row of healthRows) {
  const pad = row.status.padEnd(4);
  const name = row.key.padEnd(22);
  const count = String(row.eventsFound).padStart(3);
  const source = row.eventSource ? ` ${row.eventSource}` : "";
  console.log(`${pad} ${name} ${count} events${source}`);
  if (row.detail) {
    console.log(`     ${row.detail}`);
  }
}

/** @type {{ new: number, changed: number, unchanged: number, new_items: AuditItem[], changed_items: AuditItem[] }} */
const merged = {
  new: 0,
  changed: 0,
  unchanged: 0,
  new_items: [],
  changed_items: []
};

for (const summary of body.data.summaries) {
  if (!isRecord(summary) || !isRecord(summary.persist_preview)) {
    continue;
  }
  const preview = summary.persist_preview;
  merged.new += typeof preview.new === "number" ? preview.new : 0;
  merged.changed += typeof preview.changed === "number" ? preview.changed : 0;
  merged.unchanged += typeof preview.unchanged === "number" ? preview.unchanged : 0;
  if (Array.isArray(preview.new_items)) {
    merged.new_items.push(...preview.new_items);
  }
  if (Array.isArray(preview.changed_items)) {
    merged.changed_items.push(...preview.changed_items);
  }
}

if (!isPromote) {
  /** @type {SeedMetric[]} */
  const allSeedMetrics = [];
  for (const summary of body.data.summaries) {
    if (isRecord(summary) && Array.isArray(summary.seed_metrics)) {
      allSeedMetrics.push(.../** @type {SeedMetric[]} */ (summary.seed_metrics));
    }
  }
  printPreflightEventSummary(allSeedMetrics, merged);
}

if (isPromote) {
  console.log("");
  console.log("=== Promote result ===");
  for (const summary of body.data.summaries) {
    if (!isRecord(summary) || summary.dry_run === true) {
      continue;
    }
    const source = typeof summary.source === "string" ? summary.source : "unknown";
    const eventsFound = typeof summary.events_found === "number" ? summary.events_found : 0;
    const errorCount = typeof summary.errors === "number" ? summary.errors : 0;
    const ok = summary.ok === true;
    const persisted =
      isRecord(summary.persistence) && summary.persistence.persisted === true;
    const candidates =
      isRecord(summary.persistence) && typeof summary.persistence.candidates === "number"
        ? summary.persistence.candidates
        : eventsFound;
    const status = ok && persisted ? "OK  " : "FAIL";
    console.log(
      `${status} ${source.padEnd(22)} scraped ${String(eventsFound).padStart(3)}  persisted ${persisted ? String(candidates).padStart(3) : " no "}  errors ${errorCount}`
    );
    if (!ok && typeof summary.message === "string" && summary.message) {
      console.log(`     ${summary.message}`);
    } else if (!persisted && isRecord(summary.persistence) && typeof summary.persistence.reason === "string") {
      console.log(`     ${summary.persistence.reason}`);
    }
    if (isRecord(summary.validation) && Array.isArray(summary.validation.soft) && summary.validation.soft.length > 0) {
      for (const issue of summary.validation.soft) {
        if (issue.message) {
          console.log(`     warn: ${issue.message}`);
        }
      }
    }
  }

  if (merged.new_items.length > 0 || merged.changed_items.length > 0) {
    console.log("");
    console.log("=== Promote persist preview ===");
    console.log(`+${merged.new} new  ~${merged.changed} changed  =${merged.unchanged} unchanged`);
    console.log("");
    if (merged.new_items.length > 0) {
      console.log("New:");
      for (const item of merged.new_items) {
        printEventLine({
          title: item.title,
          url: resolveEventUrl(item),
          start_ts: item.start_ts
        });
      }
    }
    if (merged.changed_items.length > 0) {
      console.log("");
      console.log("Changed:");
      for (const item of merged.changed_items) {
        const fields = Array.isArray(item.changed_fields) ? item.changed_fields.join(", ") : "?";
        printEventLine({
          title: item.title,
          url: resolveEventUrl(item),
          start_ts: item.start_ts
        });
        console.log(`    (${fields})`);
      }
    }
  }
}

console.log("");

const promoteFailed = isPromote &&
  body.data.summaries.some(
    (summary) =>
      isRecord(summary) &&
      summary.dry_run !== true &&
      (summary.ok !== true ||
        !isRecord(summary.persistence) ||
        summary.persistence.persisted !== true)
  );

const anyFail = healthRows.some((row) => row.status === "FAIL") || promoteFailed || staleWorker;
process.exit(anyFail ? 1 : 0);
