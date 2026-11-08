# November 6 approvals, source integrations, and full run

The authorized November 4 review batch was applied to cloud-dev: **25 new approvals, four updates, and three rejections**. The remaining proposed new approval, November 5 ArtHop at South of Shaw, had already ended and was held. All 29 published records remain scheduled. The November public calendar returns 220 upcoming events and agrees with the database for every day checked at 15:30 Pacific on November 6.

The subsequent full run reached every collection and maintenance stage. **AI enrichment is incomplete:** Gemini returned HTTP 402 `RESOURCE_EXHAUSTED` because prepaid credits are depleted. The run exits non-zero and records that failure. The Fair feed also returned zero events, and VenuNite had one HTTP 403 while still supplying 42 records. VenuNite remains enabled.

## Three integrated sources

These use the existing registry, candidate pipeline, detail handling, occurrence matching, and quality workflow. The full local workflow wrote directly to cloud-dev; no database replacement or Cloudflare code deployment was performed.

| Source | Collected | Review result | Identity and map checks |
| --- | ---: | --- | --- |
| Fresno County Public Library | 144 | 139 recommended approvals; three volunteer shifts held for eligibility; two starts passed during review | Ten physical branches, all coordinates present; 77 recurring groups with separate occurrence IDs |
| Fresno State public arts | 20 | Seven recommended approvals, 12 awaiting AI, one existing Briggs recital duplicate | All coordinates present; internal, online, all-day, and undivided multi-day ranges excluded |
| Fresno Philharmonic | 10 | Eight recommended approvals; two existing Elgar performances linked as duplicates | All coordinates present; each performance retains its own ID under its concert series |

Preflight used only public pages/endpoints and returned 145 library events, 20 arts events, and ten Philharmonic performances without fetch errors. One library start passed before the full collection. The Philharmonic Barn dinner remains excluded until its precise venue is verified. All 174 records collected from these three sources have distinct provider IDs and map coordinates. None has an issue in the saved coordinate/venue/time quality audit.

## Fresh run review

Compared with the snapshot taken after applying the authorized batch, the workflow added **224 candidates**: 173 pending review, 33 awaiting enrichment, 13 duplicates, and five rejected by existing exclusions. It also refreshed 31 existing candidate payloads/statuses. No new events were published during this collection; no existing publication content was overwritten or deleted.

The review of this changed cohort recommends **157 new approvals** and holds **65 records**. Seven other rows are review-state churn with their existing publications intact. Nine reviewed rows are already rejected and 17 are linked duplicates. These categories cover the changed cohort, not the entire historical queue. Recommendations are saved separately from the batch already executed. Recheck start times, current statuses, and timestamps before executing a future approval plan.

Key holds and next actions:

- **AI backlog: 51 model-eligible rows.** The actual pipeline predicate identifies 32 awaiting-enrichment rows, 18 updates, and one pending-review row. One additional awaiting-enrichment row already has sufficient structured data but was not transitioned before the interrupted batch ended. Restore Gemini credits, start `pnpm ingest:dev`, then run `pnpm ingest:enrich --all`. Repeat the quality audit and manual review afterward; recollecting every source is unnecessary.
- **Two conflicting campus recitals.** Vanessa Ramirez and Aidan Godinho are both listed at the Fresno State Concert Hall on November 20 at 7:30pm. Confirm whether this is a shared recital or a booking error. Their individual source identities are retained. See the exact IDs and links in `held-events.csv`.
- **Three library volunteer shifts.** Woodward Park Teen Shelf Managers describes volunteer work rather than a regular drop-in activity. Confirm new-attendee eligibility. Programs with simultaneous starts in different library rooms remain separate.
- **Missing organizer links and unreliable dates/prices.** Hold VenuNite entries without a public event/ticket page; false-looking December Titus recurrences; Rainbow concerts with unverified zero minimum prices; and conflicting Switch club listings. Resolve against the organizer/ticket source before approving.
- **Tower Kpop on November 20.** Preserve the two performances, with doors/show at 3:30/4:30pm and 6:30/7:30pm. The current imported 3:30pm entry is a doors time and remains held until split correctly.
- **Strummers source disagreements and review-state churn.** Verify doors/show times instead of replacing reviewed starts. Seven prior churn rows stay separate. The newly approved Elijah Scott candidate reopened because its source now has a higher price and an image; Vineyard Saturday reopened after the feed removed its reviewed series, tags, category, and canonical URLs. Both published records retain the authorized content. Confirm Elijah's checkout price; preserve Vineyard's existing series when accepting a future update.
- **New December 5 Vineyard duplicate.** Link candidate `c205d01c-243a-445c-b386-9f9cbe58c429` to published event `ad9213c1-ec42-49fa-82a3-9fe99f978363` after checking its series. This is the one new group relative to the previous duplicate audit.
- **Fair remains separate.** All 431 held Fair/Fairgrounds candidates retain their prior review state and series. The 11 pre-approve errors are the existing Fair slug/content conflicts. Its annual October-only collector returned zero; year-round Fairgrounds coverage still needs its own feed. Retain each performance as a distinct occurrence under the Fairgrounds parent when resolving these.
- **Older quality findings remain.** The audit reports 34 duplicate groups, 26 series gaps, 12 suspicious shared-pin groups, and nine possible doors/show pairs. These require scoped review; the orphan preview found zero deletions. The 29 published missing-coordinate flags are historical; 11 upcoming publications have unverified physical-venue fields. `upcoming-quality-issues.json` gives the exact upcoming IDs and suggested checks. Two ingest-run records from June 21 remain historically marked running; no run from this task is still running.

## Execution safeguards and verification

An initial attempt exposed the existing enrichment retry loop repeatedly calling a depleted provider without progress. Only this task's process group was stopped. The worker now stops a batch after a failed model response, the CLI reports errors/no progress, and the full workflow continues exclusions/address cleanup and maintenance previews while reporting the incomplete AI stage. The guarded full rerun verified this behavior. No successful new model inference is claimed.

All three authorized rejections and the older 27 rejections remain rejected. A separate, earlier user-rejected Bored Teachers listing was reaffirmed after collection relinked its erroneous 4am listing as a duplicate; its canonical publication was retained. Both hidden events remain unpublished and return public HTTP 404. The six superseded and four cancelled records retain their states. Broad relinking and orphan deletion were previewed only. Ingest crons were not enabled.

Validation passed: **440 worker tests in 77 files, 27 workflow tests, and ingest TypeScript checking**. The four protected pre-existing source files match their initial hashes. The source registry has 15 entries. The task-owned local workers stopped on workflow exit.

## Saved evidence

- `execution-summary.json`, `applied-results.json`, `actions.jsonl`: exact authorized mutations and later reaffirmation.
- `review-summary.json`, `recommended-plan.json`, `ready-approvals.csv`, `held-events.csv`, `review-state-churn.csv`: new review recommendations, not executed.
- `ai-backlog.json`: model eligibility computed with the repository's actual predicate.
- `quality-final.json`, `workflow-results.txt`, `pipeline.log`, `interrupted-run.log`: sanitized execution and audit evidence. The quality report predates the final exact Bored Teachers rejection reaffirmation; final snapshots contain that reaffirmation.
- `live-verification.json`, `live-calendar.json`, `final-events.json`, `final-event_candidates.json`: publication, calendar, and review-state verification.
- `SOURCE_LEDGER.json`, `tested-source-version.json`: exact research sources, decisions, test counts, base commit, and tested worktree file hashes.
