/**
 * Observability for HTML scrapers: emit a structured log when a load-bearing CSS
 * selector matches zero nodes. A site re-skin usually changes class names before it
 * changes content, so a sudden "selector_no_match" is the earliest signal that a
 * parser has gone stale — well before the per-venue low-event-count warning fires.
 */
export function warnIfSelectorEmpty(opts: {
  venueKey: string;
  selector: string;
  matched: number;
}): void {
  if (opts.matched > 0) {
    return;
  }
  console.log(
    JSON.stringify({
      event: "venue_ingest",
      step: "selector_no_match",
      venue_key: opts.venueKey,
      selector: opts.selector
    })
  );
}
