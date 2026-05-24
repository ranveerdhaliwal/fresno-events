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

```bash
pnpm db:start    # start containers
pnpm db:reset    # migrations + seed
pnpm db:status   # local API URL + service_role for .dev.vars
pnpm db:stop     # stop containers
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

| Target | Command |
| --- | --- |
| Local | `pnpm db:reset` |
| Cloud dev | `supabase db push` (linked) or MCP `apply_migration` with approval |
| Prod | Manual, dev-first — see [LAUNCH_PLAN.md](LAUNCH_PLAN.md) |

Source of truth: `supabase/migrations/*.sql`.
