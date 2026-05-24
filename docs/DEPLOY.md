# Deployment (redirect)

**Use [LAUNCH_PLAN.md](LAUNCH_PLAN.md) instead.** It is the single checklist for:

1. **Now** — Docker, local Supabase, cloud **dev** Supabase, secrets, BR token  
2. **Next** — implement [INGESTION_OVERHAUL_PLAN.md](INGESTION_OVERHAUL_PLAN.md)  
3. **Then** — dry-run and real ingest into dev DB, UI work  
4. **Later** — cloud prod (API + Pages only; no prod ingest)

This file was an 800+ line Cloudflare/Supabase runbook and overlapped with LAUNCH_PLAN. It confused “what do I do today?” vs “how do I ship prod?”.

---

## If you need production deploy later

Before going live you will still need (summarized):

| Piece | Prod? |
|-------|-------|
| Supabase `what-up-fresno-prod` | Yes |
| API Worker `fresno-events-api` | Yes |
| Cloudflare Pages → whatupfresno.com | Yes |
| Ingest Worker on prod | **No** — not deployed; no prod cron |
| Events in prod | Promote from dev (manual / future job) |

Wrangler profiles: `wrangler deploy --env dev` vs `--env prod` on `apps/api` only for prod path.

Secret parity (API): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_REVIEW_TOKEN`, R2 bucket for images.

When you are ready for that phase, open a fresh task and we can restore a dedicated **PRODUCTION_DEPLOY.md** from git history (`git show HEAD~N:docs/DEPLOY.md`) or rewrite a short prod-only checklist.

---

**Start here:** [LAUNCH_PLAN.md](LAUNCH_PLAN.md)
