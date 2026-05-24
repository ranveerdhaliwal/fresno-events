import type { IngestEnv } from "@/env";
import type { BrApiEnvelope, BrCrawlJob, BrCrawlRecord, BrCrawlRequestBody } from "@/browser-rendering/types";

const baseUrl = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/crawl`;

function brHeaders(env: IngestEnv): HeadersInit {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json"
  };
}

async function parseBrResponse<T>(response: Response): Promise<BrApiEnvelope<T>> {
  const json = (await response.json()) as BrApiEnvelope<T>;
  if (!response.ok || !json.success) {
    const message = json.errors?.map((entry) => entry.message).join("; ") ?? response.statusText;
    throw new Error(`Browser Rendering API error (${response.status}): ${message}`);
  }
  return json;
}

export async function startCrawl(env: IngestEnv, body: BrCrawlRequestBody): Promise<string> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
  }

  const response = await fetch(baseUrl(accountId), {
    method: "POST",
    headers: brHeaders(env),
    body: JSON.stringify(body)
  });
  const json = await parseBrResponse<string>(response);
  return json.result;
}

export async function getCrawlJob(env: IngestEnv, jobId: string, opts?: { limit?: number }): Promise<BrCrawlJob> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
  }

  const query = opts?.limit ? `?limit=${opts.limit}` : "";
  const response = await fetch(`${baseUrl(accountId)}/${jobId}${query}`, { headers: brHeaders(env) });
  const json = await parseBrResponse<BrCrawlJob>(response);
  return json.result;
}

/** DELETE — stops an in-flight crawl; status becomes `cancelled_by_user`. */
export async function cancelCrawlJob(env: IngestEnv, jobId: string): Promise<void> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
  }

  const response = await fetch(`${baseUrl(accountId)}/${jobId}`, {
    method: "DELETE",
    headers: brHeaders(env)
  });
  await parseBrResponse<unknown>(response);
}

export async function fetchAllRecords(env: IngestEnv, jobId: string): Promise<BrCrawlRecord[]> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
  }

  const out: BrCrawlRecord[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ status: "completed" });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await fetch(`${baseUrl(accountId)}/${jobId}?${params}`, { headers: brHeaders(env) });
    const json = await parseBrResponse<BrCrawlJob>(response);
    out.push(...(json.result.records ?? []));
    cursor = json.result_info?.cursor ?? json.result.cursor;
  } while (cursor);

  return out;
}
