# November 8 publication, Fair repair and promotion audit

## Applied to cloud-dev

Published **173 new events**: 134 Fresno County Library programs, five Fresno State arts events, eight Philharmonic performances, and 26 Fairgrounds occurrences. Seven previously recommended events had already started and were skipped. All 173 resulting publications were verified as scheduled after the full run.

The Fairgrounds collection found 32 upcoming occurrences. Four remain held: Fresno Ag Expo (6:30am API versus 7am detail page), Valley Deaf Festival (Commerce Building versus Junior Exhibit Building), and both Fan-Verse occurrences (December 12/13 API versus December 11/12 copy). Two already matched publications. The November museum event was retained; the existing Bridal Expo was updated to **November 15, 1:30–5pm**, free advance passes or $10 at the door, under the Fairgrounds parent. No second Bridal Expo was created.

The 26 new Fairgrounds publications comprise 18 flea-market dates, Gold Gulch, the Card Show, Drive Forward Expo, two Anime Wave dates, two Christmas in the Valley dates, and the December museum opening. Verified end times, admission conditions and on-site coordinates were supplied through manual review. No successful AI inference is claimed for these approvals.

The 431 previously rejected expired Fair/Fairgrounds candidates remain rejected. All existing publication statuses remain unchanged: six superseded, four cancelled and two hidden entries are preserved. The 170 historical annual-Fair publications remain individually accessible. Two previously rejected listings that ingestion had relabelled as duplicates were restored to rejected; a regression fix now prevents that transition when the resolved review status is rejected.

Shared venue records also received the already-reviewed new-source addresses/pins for Saroyan, Shaghoian, Warkentine and Fresno State Concert Hall. These affect existing events at those venues. The November 6 source ledger records the official address checks; notably Shaghoian uses 2770 E International Avenue and Warkentine uses 1717 S Chestnut Avenue.

## Full run

The workflow collected 244 Ticketmaster records, 759 venue-source records and 39 VenuNite records after retry. The initial VenuNite request was interrupted by a local worker reload. Its retry completed accessible pages but page 3 returned HTTP 403, so coverage is partial. VenuNite remains enabled as requested.

Gemini returned HTTP 402 `RESOURCE_EXHAUSTED` for depleted prepaid credits. Enrichment stopped without repeatedly spending attempts on the same row. Detail backfill, exclusions, address checks, relink/orphan previews and quality inspection continued. The overall run correctly reported failure/incompleteness; it was not a fully successful AI run. Restore provider credits, run `pnpm ingest:enrich --all`, then repeat the quality audit and manual review.

There were **63 newly discovered candidates**. After reviewed Fairgrounds publication and automatic exclusions/linking: 26 approved, 22 awaiting enrichment, nine pending review, three rejected and three duplicates. The [next-review packet](NEXT_REVIEW.md) lists the 31 still-open new candidates with specific next steps. The three new records ready for the next approval review are Sunnyside Fun and Games, Woodward Park Teen DIY, and Men's Basketball vs Utah State. Two equestrian records have unannounced starts. No placeholders were published.

Final database: 2,283 event rows, including 2,271 scheduled; candidate queue contains 214 pending review, 86 needs changes and 54 awaiting enrichment. These are whole-database counts, including older records. One of today's Library approvals reopened when its source announced *Supergirl*; the approved publication remains visible while that update is reviewed.

## Fair structure and failure analysis

Previously, a pinned 2026 season and October-only discovery omitted year-round Fairgrounds listings. Single-show IDs and multiple-show IDs used inconsistent formats, so adding another performance could change which show owned an existing ID. Day-level/fuzzy linking and series pagination could then collapse or hide legitimate performances.

The collector now queries the current/upcoming annual October season plus every month in a rolling 180-day Fairgrounds window. Pacific time controls rollover. Each performance consistently uses provider ID + local date + start time, including single-show days and text-only showtimes. Adding/removing/reordering another performance does not change its ID. Deduplication preserves independently scheduled Fair performances. Annual events use `series:bigfresnofair:YYYY`; year-round events use `series:fresno-fairgrounds`. The series page fetches every page and displays the parent name.

The official 2027 season is October 6–17. No 2027 annual performances were returned yet; none were invented or copied forward. The live cutover had no upcoming official-Fair candidates using the old ID format. Historical rejected and published IDs were retained. Reschedules still require review; this is not an automatic old/new-ID migration. Verify future season boundaries before extending the explicitly verified season map beyond 2027.

The Fair CMS supplied missing/zero coordinates and a California-centroid pin for an on-site event. The parser now uses the existing verified grounds pin only when the address is omitted or matches 1121 South Chance Avenue. Precise stage pins inside the grounds are retained. A different explicit address does not receive the grounds fallback.

## Focused code audit

Reviewed ingestion orchestration, source parsing, candidate persistence, occurrence matching, approval, calendar/series retrieval and workflow verification. This was not a dependency/security audit or a measured browser performance profile.

| Finding | Change or next action |
| --- | --- |
| `--no-enrich` did not reach per-venue persistence, repeating global enrichment/detail work | Fixed propagation. Collection persists each source; final post-promote performs deferred work. A regression test proves AI/detail work is skipped in the flagged venue path. |
| Duplicate linking overrode rejected review status | Fixed and tested rejection precedence. Exact earlier rejections restored. |
| Fair identity, coverage and map-pin faults | Fixed as described above, with live repeated collection and parser/collector regressions. |
| Quality audit ignored published end times | Added `end_ts` to fetched and normalized published records; regression covers inverted published durations. It found 21 historical invalid durations, zero upcoming ones. |
| False off-season Fair health failure | Error-free empty annual Fair results outside Pacific October are warnings; actual source errors still fail. |
| CI did not run workflow regressions or production web build | Added both checks. |
| Remaining duplicate/series/map flags | 29 possible duplicate groups, 26 series gaps, 12 shared-pin groups and nine possible doors/show pairs remain review leads, not proven duplicates. Review exact IDs before applying changes. |
| Broad relink proposes 972 changes | Kept dry-run. It includes 78 duplicate-to-primary promotions and 40 demotions. Split into verified occurrence groups before any application; never bulk-apply over held events. Orphan preview found zero deletions. |
| Legacy publication data | 29 missing-coordinate flags and 21 invalid durations are historical. Eleven upcoming publications have unverified physical-venue fields; verify their addresses/eligibility before editing. No upcoming publication has a missing/invalid coordinate or inverted end time in this audit. |
| Library recurring series derived from mutable titles | *Sunnyside Cinema* changing to *Supergirl* demonstrates parent-name churn. Prefer a verified provider recurrence ID when available; otherwise preserve the reviewed series on title-only updates. Do not merge unrelated programs by approximate title. |
| General day listing has a 50-result API cap | Calendar month and series pagination are fixed. A day with more than 50 events still needs generic listing pagination. Current November maximum is 32, so this did not truncate today's verification. |
| Web entry bundle is 861.65kB minified / 260.15kB gzip | Follow up with route-level lazy loading and measured map/library chunking. Build passed; no speculative dependency upgrade or unmeasured chunk tuning was applied. |
| Two June 21 ingest runs remain marked running | Historical records, not processes from this operation. Mark them failed only in a scoped administrative cleanup; no current run remains running. |

The pre-approve audit reports zero errors and one existing AI warning for The Expendables. Global quality counts include history and unresolved candidates; they are not a reason to bulk delete or reject those records.

## Verification and merge preparation

- Full repository tests passed: shared 146, API 95, web 332; the final worker rerun passed 445 tests in 79 files. Total: **1,018 tests**, plus **32 workflow tests**.
- All package typechecks/lint passed. Production web build and `git diff --check` passed.
- Local and public November calendar APIs both returned **347 upcoming events**. Every newly approved Fairgrounds ID appears in the 29-event upcoming Fairgrounds series. The historical annual series returned **170 unique events over four pages**.
- Built local calendar returned HTTP 200. Browser automation failed before executing because its Node runtime rejected the WSL sandbox cwd URI. **Mobile visual review remains outstanding**; do not treat the HTTP check as a screenshot review.
- Four pre-existing files identified at task start were preserved byte-for-byte. Exact source hashes and the base commit are in `tested-source-version.json`.

Work is on `codex/fair-sources-promotion-audit` for a draft PR against `main`. It includes the related calendar, deduplication, source and workflow changes accumulated in this chat, plus the prior unmerged cross-source dedupe commit. This operation wrote cloud-dev data directly; it did not replace a database, enable crons, merge to main, or deploy application code.

Local mutation journals, full snapshots, raw source HTML and logs are retained in this operation directory / `/tmp/fresno-promote-20261108` for recovery but are intentionally excluded from the PR. The committed report, next-review list, source ledgers and source hashes contain the concise review evidence.
