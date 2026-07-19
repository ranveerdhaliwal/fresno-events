/** EPA-style AQI category / value → emoji for the nav chip. */
export function airQualityIconFor(aqi: number, category: string): string {
  const lower = category.toLowerCase();
  if (aqi <= 50 || lower.includes("good")) return "🌿";
  if (aqi <= 100 || lower.includes("moderate")) return "😷";
  if (aqi <= 150 || lower.includes("sensitive")) return "😣";
  if (aqi <= 200 || lower.includes("unhealthy")) return "🚫";
  if (aqi <= 300 || lower.includes("very")) return "☠️";
  return "☢️";
}
