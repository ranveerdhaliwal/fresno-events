import { z } from "zod";

const MediaRawSchema = z.object({
  mediaurl: z.string().url().optional()
});

const VisitFresnoDocSchema = z.object({
  _id: z.string(),
  recid: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  dates: z.object({
    eventDate: z.string()
  }),
  location: z.string().optional(),
  address1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  description: z.string().optional(),
  linkUrl: z.string().optional(),
  absoluteUrl: z.string().url().optional(),
  url: z.string().optional(),
  media_raw: z.array(MediaRawSchema).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  times: z.string().optional(),
  recurrence: z.string().optional(),
  hostname: z.string().optional(),
  recurType: z.union([z.string(), z.number()]).optional()
});

const VisitFresnoDocsPageSchema = z.object({
  count: z.number().optional(),
  docs: z.array(VisitFresnoDocSchema)
});

export const VisitFresnoResponseSchema = z.object({
  docs: z.union([z.array(VisitFresnoDocSchema), VisitFresnoDocsPageSchema])
});

export type VisitFresnoDoc = z.infer<typeof VisitFresnoDocSchema>;
export type VisitFresnoResponse = z.infer<typeof VisitFresnoResponseSchema>;
