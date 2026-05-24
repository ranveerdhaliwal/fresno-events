import { z } from "zod";

export const LineupEntrySchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  time: z.string().optional(),
  stage: z.string().optional()
});

export type LineupEntry = z.infer<typeof LineupEntrySchema>;

export const LineupSchema = z.array(LineupEntrySchema);

export function parseLineup(value: unknown): LineupEntry[] | undefined {
  const parsed = LineupSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
