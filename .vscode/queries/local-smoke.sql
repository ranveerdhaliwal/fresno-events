-- Fresno Events local Supabase (pnpm db:start)
-- Run: highlight query → right-click → Run Query (or F5 in this file)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY 1;
