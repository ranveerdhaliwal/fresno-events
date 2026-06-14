#!/usr/bin/env node
/** Print every pnpm ingest:promote --source=… line (plus promote-all). */

import { listPromoteSources } from "./ingest-resolve-source.mjs";

console.log("pnpm ingest:promote-all");
for (const source of listPromoteSources()) {
  console.log(`pnpm ingest:promote --source=${source.promoteSource}`);
}
