import { z } from "zod";

export const CursoCreateSchema = z.object({
  nome_curso: z.string().trim().min(1).max(150),
  categoria: z.string().trim().min(1).max(80),
  carga_horaria: z.number().int().nonnegative().nullable().optional(),
  status: z.string().trim().max(20).optional(),
});
export const CursoUpdateSchema = CursoCreateSchema.partial();
export type CursoCreateDTO = z.infer<typeof CursoCreateSchema>;
export type CursoUpdateDTO = z.infer<typeof CursoUpdateSchema>;
