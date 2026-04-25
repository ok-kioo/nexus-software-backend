import { z } from "zod";

export const MatriculaCreateSchema = z.object({
  aluno_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  numero_matricula: z.string().trim().min(1).max(50),
  data_inicio: z.string().nullable().optional(),
  data_fim: z.string().nullable().optional(),
  status: z.string().trim().max(20).optional(),
});
export const MatriculaUpdateSchema = MatriculaCreateSchema.partial();
export type MatriculaCreateDTO = z.infer<typeof MatriculaCreateSchema>;
export type MatriculaUpdateDTO = z.infer<typeof MatriculaUpdateSchema>;
