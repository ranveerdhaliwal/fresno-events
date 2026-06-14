import assert from "node:assert/strict";
import test from "node:test";

import { listPromoteSources, resolveIngestSource } from "./ingest-resolve-source.mjs";

test("resolves promoteSource visitfresnocounty", () => {
  const r = resolveIngestSource("visitfresnocounty");
  assert.equal(r.runs[0]?.scraper, "venue-ingest");
  assert.deepEqual(r.runs[0]?.venues, ["visit-fresno-county"]);
});

test("resolves promoteSource strummers", () => {
  const r = resolveIngestSource("strummers");
  assert.deepEqual(r.runs[0]?.venues, ["strummers"]);
});

test("legacy api: prefix still resolves", () => {
  const r = resolveIngestSource("api:milb");
  assert.deepEqual(r.runs[0]?.venues, ["milb-grizzlies"]);
});

test("resolves ticketmaster", () => {
  const r = resolveIngestSource("ticketmaster");
  assert.equal(r.runs[0]?.scraper, "ticketmaster");
});

test("all venues", () => {
  const r = resolveIngestSource("--all-venues", { allVenues: true });
  assert.equal(r.runs[0]?.scraper, "venue-ingest");
  assert.deepEqual(r.runs[0]?.venues, []);
});

test("rejects venue-ingest", () => {
  assert.throws(() => resolveIngestSource("venue-ingest"), /promote-all/);
});

test("comma-separated promote sources", () => {
  const r = resolveIngestSource("strummers,savemart");
  assert.deepEqual(r.runs[0]?.venues, ["save-mart", "strummers"]);
});

test("rejects mixed api scraper and venue source", () => {
  assert.throws(() => resolveIngestSource("ticketmaster,strummers"), /separate promote/);
});

test("listPromoteSources includes visitfresnocounty and ticketmaster", () => {
  const names = listPromoteSources().map((s) => s.promoteSource);
  assert.ok(names.includes("visitfresnocounty"));
  assert.ok(names.includes("ticketmaster"));
  assert.equal(names.filter((n) => n === "visitfresnocounty").length, 1);
});
