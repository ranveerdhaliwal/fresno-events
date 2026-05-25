# Database access (local + cloud dev)

How humans and Cursor agents should reach Postgres in this repo.

| Target | Best for | How |
| --- | --- | --- |
| **Cloud dev** | Queries, cleanup, migrations on hosted dev data | Supabase MCP (OAuth) |
| **Local Docker** | Ingest iteration before cloud, schema reset | `pnpm db:*` + Docker/`psql` |
| **Workers** | Runtime API/ingest reads/writes | `.dev.vars` (`SUPABASE_URL` + `service_role`) — not MCP |

**Do not** point MCP or ingest at **prod** unless explicitly requested.

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

Prefer MCP tools over raw `fetch` or guessing credentials:

1. `list_tables` — schema overview (`schemas: ["public"]`)
2. `execute_sql` — `SELECT` / diagnostics (read-only by default at login scope)
3. `list_migrations` — compare applied vs `supabase/migrations/`
4. `get_logs` — Postgres/API errors when debugging ingest
5. `apply_migration` — only with explicit user approval for DDL on remote

Example prompts: row counts per table, stale `event_candidates`, latest `ingest_runs`, draft cleanup SQL.

### Workers vs MCP

| Credential | Used by | Purpose |
| --- | --- | --- |
| `service_role` in `apps/api/.dev.vars`, `workers/ingest/.dev.vars` | Wrangler at runtime | App reads/writes via Supabase REST |
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
pnpm db:status      # URLs + service_role for .dev.vars
pnpm db:migrate     # pending migrations only — uses DEV_TARGET from dev-target.env
pnpm db:migrate:local
pnpm db:migrations  # list applied vs supabase/migrations/
pnpm db:reset       # wipe DB + all migrations + seed (destructive)
```

| Service | URL / connection |
| --- | --- |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| REST API | `http://127.0.0.1:54321` → `SUPABASE_URL` in `.dev.vars` |
| Studio | http://127.0.0.1:54323 |
| Inbucket | http://127.0.0.1:54324 |

`project_id` in `supabase/config.toml` is `what-up-fresno` → DB container name is typically `supabase_db_what-up-fresno`.

### Agent workflow (local)

MCP is scoped to **cloud dev** only. For local Postgres, use the shell:

```bash
# Confirm stack is up
docker ps --filter name=supabase_db

# One-off query (adjust container name if different)
docker exec supabase_db_what-up-fresno psql -U postgres -d postgres -c \
  "SELECT count(*) FROM event_candidates;"
```

If `pnpm db:status` fails, check Docker first; local stack must be running.

### Optional: VS Code PostgreSQL extension

See [.vscode/POSTGRES.md](../.vscode/POSTGRES.md) for manual SQL in the editor. Agents usually use Docker exec or MCP instead.

---

## Which database am I hitting?

| `.dev.vars` `SUPABASE_URL` | Data lives in |
| --- | --- |
| `http://127.0.0.1:54321` | Local Docker |
| `https://mrfkpvbvgzbtcutulfnc.supabase.co` | Cloud dev |

Ingest + API `.dev.vars` should match: both local or both cloud dev when testing end-to-end.

---

## Push local review data to cloud dev

After `pnpm ingest:promote-apis`, enrich, and review locally:

1. Add `SUPABASE_DB_PASSWORD_CLOUD_DEV` to `dev-target.env` (Supabase Dashboard → **Database** password, not the service role key).
2. `pnpm db:push-cloud-dev --yes` — dumps local `ingest_runs` + `event_candidates`, replaces cloud dev copies.
3. `pnpm env:cloud-dev` and restart `pnpm dev:api` so `/admin` reads the cloud queue.

Local Postgres URI is fixed in the script: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

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
