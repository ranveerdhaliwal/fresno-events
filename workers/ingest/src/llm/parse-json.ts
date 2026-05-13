/**
 * Best-effort JSON extraction from model output (code fences, extra prose).
 */
export function parseJsonFromModel<T>(value: string): T | null {
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
