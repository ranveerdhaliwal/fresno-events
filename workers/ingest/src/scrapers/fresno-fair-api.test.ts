import { afterEach, expect, it, vi } from "vitest";
import { run } from "./fresno-fair-api";
afterEach(() => vi.unstubAllGlobals());
it("collects the current season and rolling grounds months despite stale configuration, excluding history", async () => {
  const dates: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const first = JSON.parse(init.body).dates.split(",")[0] as string;
      dates.push(first);
      const [month, , year] = first.split("/");
      const day = month === "10" ? "06" : "01";
      return new Response(
        JSON.stringify({
          d: {
            Days: [
              {
                DateString: `${month}/${day}/${year}`,
                Times: [
                  {
                    Items: [
                      { EventID: 42, Name: "Public concert", Time: 1200 },
                    ],
                  },
                ],
              },
              {
                DateString: "10/07/2026",
                Times: [
                  { Items: [{ EventID: 43, Name: "Old concert", Time: 1200 }] },
                ],
              },
            ],
          },
        }),
      );
    }),
  );
  const result = await run(
    {
      runId: "test",
      now: new Date("2027-09-01T12:00:00Z"),
      userAgent: "test",
      config: {},
      secrets: {},
    },
    { seriesId: "series:bigfresnofair:2026" },
  );
  expect(result.errors).toEqual([]);
  expect(dates).toContain("10/01/2027");
  expect(dates).toContain("11/01/2027");
  expect(dates.every((date) => !date.endsWith("2026"))).toBe(true);
  expect(new Set(dates).size).toBe(dates.length);
  expect(result.metrics.pagesVisited).toBe(dates.length);
  expect(result.events.every((event) => event.title !== "Old concert")).toBe(
    true,
  );
  expect(
    result.events.find((event) => event.startTs.startsWith("2027-10-06"))
      ?.seriesId,
  ).toBe("series:bigfresnofair:2027");
  expect(
    result.events.find((event) => event.startTs.startsWith("2027-11-01"))
      ?.seriesId,
  ).toBe("series:fresno-fairgrounds");
});
