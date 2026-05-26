import type { MiddlewareHandler } from "hono";

/** Pacific (America/Los_Angeles) timestamps for wrangler dev / Worker logs. */
export function formatPacificLogTimestamp(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}

export function logStructured(event: string, fields: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: formatPacificLogTimestamp(),
      tz: "America/Los_Angeles",
      event,
      ...fields
    })
  );
}

/** Always use for failures — shows in wrangler stdout with PT timestamp. */
export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  logStructured(event, {
    level: "error",
    message,
    ...(error instanceof Error && error.stack ? { stack: error.stack.split("\n").slice(0, 5).join(" | ") } : {}),
    ...fields
  });
}

export function pacificRequestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const ts = formatPacificLogTimestamp();
    console.log(`[${ts} PT] --> ${c.req.method} ${c.req.path}`);
    await next();
    const line = `[${ts} PT] <-- ${c.req.method} ${c.req.path} ${c.res.status}`;
    if (c.res.status >= 400) {
      console.error(line);
    } else {
      console.log(line);
    }
  };
}
