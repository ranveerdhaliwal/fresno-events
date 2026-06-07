/** @param {string[]} argv */
export function parsePriorityTriageArgs(argv) {
  const out = {
    dryRun: false,
    limit: undefined,
    source: undefined
  };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      out.dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      out.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--limit") {
      continue;
    } else if (arg.startsWith("--source=")) {
      out.source = arg.slice("--source=".length);
    } else if (arg === "--help" || arg === "-h") {
      return { ...out, help: true };
    }
  }
  return out;
}
