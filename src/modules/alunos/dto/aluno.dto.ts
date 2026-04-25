import { z } from "zod";

export const AlunoCreateSchema = z.object({
  nome_aluno: z.string().trim().min(1).max(150),
  documento: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(255).nullable().optional(),
  telefone: z.string().trim().max(30).nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  status: z.string().trim().max(20).optional(),
});
export const AlunoUpdateSchema = AlunoCreateSchema.partial();
export type AlunoCreateDTO = z.infer<typeof AlunoCreateSchema>;
export type AlunoUpdateDTO = z.infer<typeof AlunoUpdateSchema>;
