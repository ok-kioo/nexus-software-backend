import { z } from "zod";

export const AlertaStatusUpdateSchema = z.object({
  status: z.enum(["ativo", "resolvido", "ignorado"]),
  motivo: z.string().max(500).optional(),
});
export type AlertaStatusUpdateDTO = z.infer<typeof AlertaStatusUpdateSchema>;

export const AlertaPromoteSchema = z.object({
  titulo: z.string().min(1).max(150).optional(),
  descricao: z.string().min(1).max(2000).optional(),
  prazo: z.string().nullable().optional(),
  prioridade: z.enum(["baixa", "media", "alta"]).optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
});
export type AlertaPromoteDTO = z.infer<typeof AlertaPromoteSchema>;