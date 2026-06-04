import { z } from "zod";

export const ImportJobIdParam = z.object({
  id: z.string().uuid({ message: "ID inválido" }),
});

export const ListImportJobsQuery = z.object({
  page: z.coerce.number().int().positive().max(1000).optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z
    .enum(["queued", "parsing", "validating", "persisting", "completed", "failed", "cancelled"])
    .optional(),
});

export type ListImportJobsQueryInput = z.infer<typeof ListImportJobsQuery>;