import { z } from "zod";

export const ContatoCreateSchema = z.object({
  aluno_id: z.string().uuid(),
  tipo: z.string().trim().min(1).max(50),
  descricao: z.string().trim().min(1).max(2000),
});
export type ContatoCreateDTO = z.infer<typeof ContatoCreateSchema>;
