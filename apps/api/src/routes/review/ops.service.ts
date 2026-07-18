import type {
  ReviewOccurrenceRelinkOpsResponse,
  ReviewVenueAddressBackfillOpsResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import {
  buildOccurrenceRelinkOpsResponse,
  buildVenueAddressBackfillOpsResponse
} from "@/routes/review/ops-message.utils";
import { ReviewRouteError } from "@/routes/review/errors";

const DEFAULT_INGEST_URL = "http://127.0.0.1:8788";

interface IngestOpsEnvelope {
  ok?: boolean;
  data?: {
    summary?: Record<string, unknown>;
    dry_run?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

function resolveIngestUrl(env: Env): string {
  const configured = env.INGEST_URL?.trim();
  return (configured || DEFAULT_INGEST_URL).replace(/\/$/, "");
}

async function postIngestTrigger(env: Env, path: string, params: URLSearchParams): Promise<IngestOpsEnvelope> {
  if (!env.ADMIN_REVIEW_TOKEN) {
    throw new ReviewRouteError("ADMIN_REVIEW_TOKEN must be configured before maintenance ops can run.");
  }

  const url = `${resolveIngestUrl(env)}${path}?${params.toString()}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "x-admin-token": env.ADMIN_REVIEW_TOKEN
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "fetch failed";
    throw new ReviewRouteError(
      `Could not reach ingest worker at ${resolveIngestUrl(env)}. Start pnpm ingest:dev. (${detail})`
    );
  }

  let payload: IngestOpsEnvelope;
  try {
    payload = (await response.json()) as IngestOpsEnvelope;
  } catch {
    throw new ReviewRouteError(`Ingest worker returned ${response.status} without JSON.`);
  }

  if (!response.ok || payload.ok !== true) {
    const message =
      payload.error?.message ??
      (typeof payload.error === "object" ? JSON.stringify(payload.error) : "Ingest maintenance op failed.");
    throw new ReviewRouteError(message);
  }

  return payload;
}

export async function runOccurrenceRelinkOps(
  env: Env,
  dryRun: boolean
): Promise<ReviewOccurrenceRelinkOpsResponse> {
  const params = new URLSearchParams();
  if (dryRun) {
    params.set("dry_run", "true");
  }

  const payload = await postIngestTrigger(env, "/occurrence-relink/trigger", params);
  const summary = payload.data?.summary ?? {};
  return buildOccurrenceRelinkOpsResponse(dryRun, summary);
}

export async function runVenueAddressBackfillOps(
  env: Env,
  dryRun: boolean,
  sourceFilter?: string
): Promise<ReviewVenueAddressBackfillOpsResponse> {
  const params = new URLSearchParams();
  if (dryRun) {
    params.set("dry_run", "true");
  }
  if (sourceFilter?.trim()) {
    params.set("source", sourceFilter.trim());
  }

  const payload = await postIngestTrigger(env, "/venue-address-backfill/trigger", params);
  const summary = payload.data?.summary ?? {};
  return buildVenueAddressBackfillOpsResponse(dryRun, summary);
}
