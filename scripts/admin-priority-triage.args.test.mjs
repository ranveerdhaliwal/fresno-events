import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parsePriorityTriageArgs } from "./admin-priority-triage.args.mjs";

describe("parsePriorityTriageArgs", () => {
  it("defaults to apply (dryRun false)", () => {
    assert.deepEqual(parsePriorityTriageArgs([]), {
      dryRun: false,
      limit: undefined,
      source: undefined
    });
  });

  it("sets dryRun when --dry-run is passed", () => {
    assert.equal(parsePriorityTriageArgs(["--dry-run"]).dryRun, true);
  });

  it("parses limit and source flags", () => {
    assert.deepEqual(parsePriorityTriageArgs(["--limit=200", "--source=venunite"]), {
      dryRun: false,
      limit: 200,
      source: "venunite"
    });
  });

  it("returns help flag for --help", () => {
    assert.equal(parsePriorityTriageArgs(["--help"]).help, true);
  });
});
