import { z } from "zod";

export const PlanoCreateSchema = z.object({
  aluno_id: z.string().uuid(),
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().min(1).max(2000),
  prioridade: z.enum(["baixa", "media", "alta"]).optional(),
  status: z.enum(["aberto", "em_andamento", "concluido", "cancelado"]).optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  prazo: z.string().nullable().optional(),
  origem_alerta: z.string().trim().max(150).nullable().optional(),
});
export const PlanoUpdateSchema = PlanoCreateSchema.partial();
export type PlanoCreateDTO = z.infer<typeof PlanoCreateSchema>;
export type PlanoUpdateDTO = z.infer<typeof PlanoUpdateSchema>;
