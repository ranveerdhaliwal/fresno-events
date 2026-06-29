# SEO Optimization Plan

Per-route meta, JSON-LD, `robots.txt`, and sitemap on the existing Vite SPA and API worker.

**Dev:** `pnpm env:local && pnpm db:start && pnpm dev`

## Deliverables

1. `packages/shared/src/seo/seo.utils.ts` — titles, canonical, og tags (`heroImage.cdnUrl` or `/og-default.png`), JSON-LD
2. TanStack Router `head` on public routes in `router.tsx`
3. `apps/web/public/robots.txt`
4. `GET /sitemap.xml` on API worker (`https://api.whatupfresno.com/sitemap.xml`)
5. Homepage `<h1>`, image alt text, thin-venue `noindex`
6. Remove `apps/api/src/routes/og.ts`

## Verify

`pnpm test` · `pnpm typecheck` · `pnpm dev` smoke test

Full spec: [`.cursor/plans/seo_optimization_plan_1894d6f1.plan.md`](../.cursor/plans/seo_optimization_plan_1894d6f1.plan.md)
