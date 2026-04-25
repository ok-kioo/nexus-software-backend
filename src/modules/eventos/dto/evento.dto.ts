import { z } from "zod";

export const EventoCreateSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(2000).nullable().optional(),
  tipo: z.string().trim().max(50).optional(),
  data_inicio: z.string().min(1),
  data_fim: z.string().nullable().optional(),
  unidade_id: z.string().uuid().nullable().optional(),
});
export const EventoUpdateSchema = EventoCreateSchema.partial();
export type EventoCreateDTO = z.infer<typeof EventoCreateSchema>;
export type EventoUpdateDTO = z.infer<typeof EventoUpdateSchema>;
