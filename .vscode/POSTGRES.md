# PostgreSQL extension (ckolkman) — local DB

**Agents:** see [docs/DATABASE_ACCESS.md](../docs/DATABASE_ACCESS.md) (MCP for cloud dev, Docker for local).

Local Postgres runs in Docker when `pnpm db:start` is up (`127.0.0.1:54322`).

## Connection wizard (one-time)

Command Palette → **PostgreSQL: Add Connection**

| Step | Value |
| --- | --- |
| Host | `127.0.0.1` |
| User | `postgres` |
| Password | `postgres` |
| Port | `54322` (not 5432) |
| SSL | Standard Connection |
| Database | pick **`postgres`** — do **not** pick "Show All Databases" |
| Display name | `127.0.0.1` (must match `vscode-postgres.defaultConnection` in settings) |

If you used a different display name, change `vscode-postgres.defaultConnection` in `.vscode/settings.json` to match exactly.

## Run queries (avoids "db not found")

1. Sidebar → **PostgreSQL** explorer → expand your connection → **right-click `postgres`** → **New Query**
2. Or open `.vscode/queries/local-smoke.sql`, click **`$(database) postgres`** in the status bar if it shows empty
3. Highlight SQL → right-click → **Run Query** (or **F5** in a `postgres` language file)

Palette-only **PostgreSQL: New Query** does not attach a database unless defaults + explorer connection line up.

## Smoke test from terminal

```bash
docker exec supabase_db_what-up-fresno psql -U postgres -d postgres -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```
