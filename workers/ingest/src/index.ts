import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import { runDetailBackfill } from "@/detail-backfill";
import { runOccurrenceRelink } from "@/occurrence-relink";
import { runVenueAddressBackfill } from "@/venue-address-backfill";
import { compactRunSummaryForLog } from "@/log-compact.utils";
import { runIngest, runPostIngestEnrichment } from "@/runner";
import { listRunnableSources } from "@/planner";
import { INGEST_VALIDATION_POLICY } from "@/validation";

export default {
  async scheduled(_controller: ScheduledController, env: IngestEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const summaries = await runIngest(env);
        for (const summary of summaries) {
          console.log(JSON.stringify({ event: "ingest_run", trigger: "scheduled", ...compactRunSummaryForLog(summary) }));
        }
      })()
    );
  },

  async fetch(req: Request, env: IngestEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        data: {
          service: "fresno-events-ingest",
          environment: env.APP_ENV ?? "unknown",
          validation_policy: INGEST_VALIDATION_POLICY,
          time: new Date().toISOString(),
          registered_sources: await listRunnableSources(env)
        }
      });
    }

    if (url.pathname === "/trigger") {
      const auth = await checkAdminAuth(req, env);
      if (auth) {
        return jsonResponse({ ok: false, error: auth }, auth.status);
      }

      const sourcesParam = url.searchParams.get("source") ?? url.searchParams.get("sources") ?? undefined;
      const venueParam = url.searchParams.get("venue") ?? undefined;
      const force = url.searchParams.get("force") === "true";
      const dryRun = url.searchParams.get("dry_run") === "true";
      const resumeJobs = url.searchParams.get("resume_jobs") === "true";
      const skipEnrichment = url.searchParams.get("no_enrich") === "true" || url.searchParams.get("skip_enrichment") === "true";
      const venueFilter = venueParam
        ? venueParam
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : undefined;
      const isVenueTrigger = (venueFilter?.length ?? 0) > 0;
      const sources = sourcesParam ?? (venueFilter?.length ? "venue-ingest" : undefined);

      if (dryRun && resumeJobs) {
        return jsonResponse(
          {
            ok: false,
            error: {
              code: "invalid_flags",
              message: "dry_run and resume_jobs cannot be used together."
            }
          },
          400
        );
      }

      const summaries = await runIngest(env, {
        force,
        dryRun,
        resumeJobs,
        skipEnrichment: true,
        signal: req.signal,
        ...(sources ? { sources } : {}),
        ...(venueFilter?.length ? { venueFilter } : {})
      });
      for (const summary of summaries) {
        console.log(JSON.stringify({ event: "ingest_run", trigger: "manual", ...compactRunSummaryForLog(summary) }));
      }

      // `--venue` implies venue-scoped persist + enrichment inside venue-ingest.
      // Do NOT run global backlog enrichment unless explicitly requested (promote-all / enrich-all).
      if (!dryRun && !skipEnrichment && !isVenueTrigger) {
        ctx.waitUntil(runPostIngestEnrichment(env));
      }

      return jsonResponse({ ok: true, data: { summaries } });
    }

    if (url.pathname === "/detail-backfill/trigger") {
      const auth = await checkAdminAuth(req, env);
      if (auth) {
        return jsonResponse({ ok: false, error: auth }, auth.status);
      }

      const dryRun = url.searchParams.get("dry_run") === "true";
      const sourceFilter = url.searchParams.get("source") ?? undefined;
      const limitParam = url.searchParams.get("limit");
      const parsedLimit = limitParam ? Number(limitParam) : NaN;
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.trunc(parsedLimit) : undefined;

      const summary = await runDetailBackfill(env, {
        dryRun,
        ...(sourceFilter ? { sourceFilter } : {}),
        ...(limit !== undefined ? { limit } : {})
      });

      return jsonResponse({ ok: true, data: { summary, dry_run: dryRun, limit } });
    }

    if (url.pathname === "/occurrence-relink/trigger") {
      const auth = await checkAdminAuth(req, env);
      if (auth) {
        return jsonResponse({ ok: false, error: auth }, auth.status);
      }

      const dryRun = url.searchParams.get("dry_run") === "true";
      const sourceFilter = url.searchParams.get("source") ?? undefined;
      const limitParam = url.searchParams.get("limit");
      const parsedLimit = limitParam ? Number(limitParam) : NaN;
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.trunc(parsedLimit) : undefined;

      const summary = await runOccurrenceRelink(env, {
        dryRun,
        ...(sourceFilter ? { sourceFilter } : {}),
        ...(limit !== undefined ? { limit } : {})
      });

      return jsonResponse({ ok: true, data: { summary, dry_run: dryRun, limit } });
    }

    if (url.pathname === "/venue-address-backfill/trigger") {
      const auth = await checkAdminAuth(req, env);
      if (auth) {
        return jsonResponse({ ok: false, error: auth }, auth.status);
      }

      const dryRun = url.searchParams.get("dry_run") === "true";
      const sourceFilter = url.searchParams.get("source") ?? undefined;

      const summary = await runVenueAddressBackfill(env, {
        dryRun,
        ...(sourceFilter ? { sourceFilter } : {})
      });

      return jsonResponse({ ok: true, data: { summary, dry_run: dryRun, source: sourceFilter } });
    }

    if (url.pathname === "/enrichment/trigger") {
      const auth = await checkAdminAuth(req, env);
      if (auth) {
        return jsonResponse({ ok: false, error: auth }, auth.status);
      }

      const dryRun = url.searchParams.get("dry_run") === "true";
      const sourceFilter = url.searchParams.get("source") ?? undefined;
      const limitParam = url.searchParams.get("limit");
      const parsedLimit = limitParam ? Number(limitParam) : NaN;
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.trunc(parsedLimit) : undefined;

      const summary = await runPostIngestEnrichment(env, {
        dryRun,
        ...(sourceFilter ? { sourceFilter } : {}),
        ...(limit !== undefined ? { limit } : {})
      });

      return jsonResponse({ ok: true, data: { summary, dry_run: dryRun, limit } });
    }

    if (url.pathname === "/ai/self-test") {
      const auth = await checkAdminAuth(req, env);
      if (auth) {
        return jsonResponse({ ok: false, error: auth }, auth.status);
      }

      const backend = getJsonPromptBackend(env, "enrichment");
      if (!backend) {
        return jsonResponse(
          {
            ok: false,
            error: {
              code: "ai_unconfigured",
              message: "No AI provider is available for this worker (configure AI binding, GEMINI_API_KEY, or ANTHROPIC_API_KEY).",
            },
          },
          503,
        );
      }

      const echo = await backend.generateJson<{ ok?: boolean }>({
        system: 'Respond with only minified JSON: {"ok":true}. No other keys.',
        user: "ping",
      });

      return jsonResponse({
        ok: true,
        data: {
          provider: backend.provider,
          echo_ok: echo?.ok === true,
        },
      });
    }

    return jsonResponse(
      { ok: false, error: { code: "not_found", message: "Route not found." } },
      404
    );
  }
} satisfies ExportedHandler<IngestEnv>;

interface AuthError {
  code: string;
  message: string;
  status: 401 | 503;
}

async function checkAdminAuth(req: Request, env: IngestEnv): Promise<AuthError | null> {
  if (!env.ADMIN_REVIEW_TOKEN) {
    return {
      code: "trigger_unconfigured",
      message: "ADMIN_REVIEW_TOKEN must be configured before manual triggers can be used.",
      status: 503
    };
  }

  const provided = req.headers.get("x-admin-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!provided || !(await secureCompare(provided, env.ADMIN_REVIEW_TOKEN))) {
    return {
      code: "trigger_auth_required",
      message: "A valid admin token is required.",
      status: 401
    };
  }

  return null;
}

async function secureCompare(actual: string, expected: string) {
  const [actualHash, expectedHash] = await Promise.all([sha256(actual), sha256(expected)]);
  let diff = actualHash.length ^ expectedHash.length;
  for (let index = 0; index < Math.max(actualHash.length, expectedHash.length); index += 1) {
    diff |= (actualHash[index] ?? 0) ^ (expectedHash[index] ?? 0);
  }
  return diff === 0;
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
