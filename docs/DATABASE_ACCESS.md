# Database access (local + cloud dev)

How humans and Cursor agents should reach Postgres in this repo.

## Default for agents: local first

**Query local Docker Postgres first** when checking ingest results, `event_candidates`, pricing, promote outcomes, or “what’s in the DB?” — unless the user explicitly asks for cloud dev. Day-to-day `pnpm ingest:promote` and `pnpm dev:api` write to **local** when `DEV_TARGET=local`. Cloud dev is often behind until you run promote there or `pnpm db:push-cloud-dev --confirm`.

| Target | Best for | How |
| --- | --- | --- |
| **Local Docker** (default) | Current ingest data, promote verification, schema reset, iteration | `pnpm db:*` + Docker `psql` |
| **Cloud dev** | Remote cleanup, shared dev DB, migrations on hosted data | Supabase MCP (OAuth) |
| **Workers** | Runtime API/ingest reads/writes | Generated `.dev.vars` from `dev-target.env` (`pnpm env:<target>`) — not MCP |

**Do not** point MCP or ingest at **prod** unless explicitly requested.

Confirm which DB is active: `.dev.vars` `SUPABASE_URL` — `http://127.0.0.1:54321` = local, `https://mrfkpvbvgzbtcutulfnc.supabase.co` = cloud dev.

---

## Cloud dev — Supabase MCP (Cursor)

Configured in `.cursor/mcp.json` (gitignored):

```json
"supabase": {
  "url": "https://mcp.supabase.com/mcp?project_ref=mrfkpvbvgzbtcutulfnc"
}
```

- **Project:** `what-up-fresno-dev`
- **Project ref:** `mrfkpvbvgzbtcutulfnc`
- **API URL:** `https://mrfkpvbvgzbtcutulfnc.supabase.co`
- **Auth:** Browser OAuth on first use (Settings → MCP → Supabase). No personal access token in config.
- **MCP server id in Cursor:** `project-0-fresno-events-supabase` (tool prefix may vary by workspace)

### Agent workflow (cloud dev)

Use MCP when the user asks for **cloud dev**, remote cleanup, or local stack is down and they confirm cloud. Do **not** assume cloud dev matches local ingest state.

1. `list_tables` — schema overview (`schemas: ["public"]`)
2. `execute_sql` — `SELECT` / diagnostics (read-only by default at login scope)
3. `list_migrations` — compare applied vs `supabase/migrations/`
4. `get_logs` — Postgres/API errors when debugging ingest
5. `apply_migration` — only with explicit user approval for DDL on remote

Example prompts: row counts per table, stale `event_candidates`, latest `ingest_runs`, draft cleanup SQL.

### Workers vs MCP

| Credential | Used by | Purpose |
| --- | --- | --- |
| `service_role` in `dev-target.env` → generated `.dev.vars` | Wrangler at runtime | App reads/writes via Supabase REST |
| Supabase MCP OAuth | Cursor agent | Ad-hoc SQL, migrations, logs |

`service_role` does **not** go in `mcp.json`. MCP does **not** replace `.dev.vars` for Workers.

### Re-auth

If MCP returns `Unauthorized`, open **Cursor Settings → MCP**, re-authenticate Supabase, then **Reload Window**.

---

## Local — Supabase in Docker

`pnpm db:start` runs the full local stack in Docker (Postgres, Studio, Kong, Auth, etc.). Requires Docker running.

### After reboot or when Docker was stopped

You do **not** need `pnpm db:reset` when you come back — that would wipe data.

| Situation | What to run |
| --- | --- |
| Computer slept / Docker Desktop stopped | `pnpm db:start` (containers were stopped; **data volumes usually still there**) |
| First time on this machine | `pnpm db:start`, then `pnpm db:reset` or `pnpm db:migrate` |
| New migration file in repo | `pnpm db:migrate` or `pnpm db:migrate:local` (keeps rows) |
| Want empty DB + demo seed | `pnpm db:reset` (destructive) |

`pnpm db:stop` stops containers without deleting volumes. `pnpm db:reset` drops the database, reapplies **all** migrations, and runs `seed.sql`.

### Commands

```bash
pnpm db:start       # start containers (run when Docker is up but stack is down)
pnpm db:stop        # stop containers (data kept in Docker volumes)
pnpm db:status      # URLs + service_role for dev-target.env
pnpm db:migrate     # pending migrations only — uses DEV_TARGET from dev-target.env
pnpm db:migrate:local
pnpm db:migrations  # list applied vs supabase/migrations/
pnpm db:reset       # wipe DB + all migrations + seed (destructive)
```

| Service | URL / connection |
| --- | --- |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| REST API | `http://127.0.0.1:54321` → `SUPABASE_URL` in `.dev.vars` |
| Studio | http://127.0.0.1:54423 (see `supabase status`; was 54323 — often blocked on WSL/Windows) |
| Inbucket | http://127.0.0.1:54324 |

`project_id` in `supabase/config.toml` is `what-up-fresno` → DB container name is typically `supabase_db_what-up-fresno`.

### Agent workflow (local) — prefer this for ingest data

MCP is scoped to **cloud dev** only. For **up-to-date candidate/ingest rows**, use local shell:

```bash
# Confirm stack is up
docker ps --filter name=supabase_db

# One-off query (adjust container name if different)
docker exec supabase_db_what-up-fresno psql -U postgres -d postgres -c \
  "SELECT count(*) FROM event_candidates;"
```

If `pnpm db:status` fails, check Docker first; local stack must be running.

### Local Studio “connection refused” (127.0.0.1:54323)

`supabase status` may still print port **54323**, but on WSL/Windows that port is often in an **excluded port range** and never binds (check: `ss -tln | grep 54323` — empty means Studio is unreachable).

This repo sets **`[studio] port = 54423`** in `supabase/config.toml`. After changing ports or Postgres major version:

```bash
supabase stop
supabase start
supabase status   # use the Studio URL shown here
```

If Postgres fails to start after bumping `major_version` to match cloud dev (17), either remove the old volume or run `pnpm db:reset` (wipes local data).

### Optional: VS Code PostgreSQL extension

See [.vscode/POSTGRES.md](../.vscode/POSTGRES.md) for manual SQL in the editor. Agents usually use Docker exec or MCP instead.

---

## Which database am I hitting?

| `.dev.vars` `SUPABASE_URL` | Data lives in |
| --- | --- |
| `http://127.0.0.1:54321` | Local Docker |
| `https://mrfkpvbvgzbtcutulfnc.supabase.co` | Cloud dev |

Use one `DEV_TARGET` in `dev-target.env` and `pnpm env:<target>` so API + ingest `.dev.vars` stay aligned.

---

## Push local data to cloud dev

After ingest, enrich, and approve locally:

1. Add `SUPABASE_DB_PASSWORD_CLOUD_DEV` to `dev-target.env` (Supabase Dashboard → **Database** password, not the service role key).
2. Link cloud dev if needed: `supabase link --project-ref mrfkpvbvgzbtcutulfnc`
3. **`pnpm review:bulk-approve`** — approve all `pending_review` candidates locally (one API call), or use `/admin` → **Approve selected** / **Approve all pending**.
4. **`pnpm db:push-cloud-dev --confirm`** — runs `supabase migration up --linked` on cloud dev, then **truncates and replaces** cloud dev tables with your local copy: `images`, `venues`, `events`, `event_candidates`, `ingest_runs`.

`--confirm` is required so the script cannot wipe cloud dev by accident (`--yes` is a deprecated alias). If any candidates fail to approve, re-run `pnpm review:bulk-approve`.

5. `pnpm env:cloud-dev` and restart `pnpm dev:api` so `/admin` reads cloud data.

Local dump uses the Supabase Docker container (`pg_dump` inside `supabase_db_*`); cloud restore needs `psql` on your PATH (or Docker). Install if missing: `sudo apt install postgresql-client` (WSL/Ubuntu).

**WSL + `Network is unreachable` on cloud push:** Direct `db.<ref>.supabase.co` is **IPv6-only**. WSL often cannot reach IPv6. The push script uses the **session pooler** (IPv4) from `supabase/.temp/pooler-url` after `supabase link`, or `SUPABASE_DB_POOLER_HOST_CLOUD_DEV` from Dashboard → Connect → Session pooler.

---

## Migrations

Source of truth: `supabase/migrations/*.sql`.

| Goal | Local | Cloud dev |
| --- | --- | --- |
| **Apply new migration, keep data** | `pnpm db:migrate:local` (or `pnpm env:local` then `pnpm db:migrate`) | `pnpm db:migrate:cloud-dev` or Supabase MCP `apply_migration` (with approval) |
| **See what’s applied** | `pnpm db:migrations` or `pnpm db:migrations local` | `pnpm db:migrations cloud-dev` |
| **Fresh DB + seed** | `pnpm db:reset` only | Do not reset cloud dev casually — use MCP/SQL cleanup per [ingest rules](../.cursor/rules/ingest-operations.mdc) |

`pnpm db:migrate` reads **`DEV_TARGET`** from `dev-target.env`:

- `DEV_TARGET=local` → `supabase migration up --local`
- `DEV_TARGET=cloud-dev` → `supabase migration up --linked` (requires `supabase link` to dev project)
- **cloud-prod** is blocked by the script

**Typical workflow**

1. Pull repo with new `supabase/migrations/*.sql`
2. `pnpm db:start` if local stack is down
3. `pnpm env:local` && `pnpm db:migrate:local`
4. Re-run ingest / check Studio
5. Cloud dev: agent applies same migration via MCP (or you run `pnpm db:migrate:cloud-dev` if CLI is linked)

MCP `list_migrations` compares remote history to the repo; use it before `apply_migration` on cloud dev.

### Migration version mismatch (CLI vs cloud dev)

If `pnpm db:push-cloud-dev` or `pnpm db:migrate:cloud-dev` fails with **Remote migration versions not found in local migrations directory** (e.g. `20260524033349`), cloud dev was migrated via MCP with a different timestamp than the repo file. The repo filename must match the remote `version` in `supabase_migrations.schema_migrations`.

1. Pull latest repo (includes `20260524033349_event_candidates_suggested_priority.sql`).
2. `pnpm db:migrate:cloud-dev` — applies any pending migrations (`seed_urls` audit, `content_fingerprint`, `images.storage_key` unique, etc.).
3. If **local** `supabase migration up` complains about `20260524000000`, run once: `pnpm db:repair:local-migration-version` (rewrites local history only; no DDL).
4. `pnpm db:push-cloud-dev --confirm`
