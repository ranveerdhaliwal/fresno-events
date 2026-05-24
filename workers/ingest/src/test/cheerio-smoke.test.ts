import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";

describe("cheerio smoke", () => {
  it("parses downtown-fresno HTML fixture", () => {
    const html = readFileSync(
      join(process.cwd(), "../../tools/spikes/fixtures/downtown-fresno-sample.html"),
      "utf8"
    );
    const $ = load(html);
    expect($(".bbq-row").length).toBeGreaterThan(0);
  });
});
