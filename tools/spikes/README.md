# Ingest API spikes (Gate A)

One-off scripts that capture real third-party response shapes before writing zod schemas.

```bash
node tools/spikes/visit-fresno-spike.mjs
node tools/spikes/downtown-fresno-spike.mjs
node tools/spikes/milb-spike.mjs
```

Fixtures land in `tools/spikes/fixtures/`. Gate B scrapers must derive zod types from these files.
