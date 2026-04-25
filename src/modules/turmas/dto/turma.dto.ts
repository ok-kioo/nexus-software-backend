import { z } from "zod";

export const TurmaCreateSchema = z.object({
  nome_turma: z.string().trim().min(1).max(150),
  unidade_id: z.string().uuid(),
  curso_id: z.string().uuid(),
  capacidade: z.number().int().positive().max(10000).optional(),
  periodo: z.string().trim().max(50).nullable().optional(),
  turno: z.string().trim().max(30).nullable().optional(),
  status: z.string().trim().max(20).optional(),
});
export const TurmaUpdateSchema = TurmaCreateSchema.partial();
export type TurmaCreateDTO = z.infer<typeof TurmaCreateSchema>;
export type TurmaUpdateDTO = z.infer<typeof TurmaUpdateSchema>;
