/** Empty annual Fair schedules are expected outside October; transport errors still fail. */
export function isExpectedSeasonalEmpty(key, now = new Date()) {
  return key === "big-fresno-fair" && new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", month: "numeric"
  }).format(now) !== "10";
}
