import { z } from "zod";

export const UnidadeCreateSchema = z.object({
  nome_unidade: z.string().trim().min(1).max(150),
  cidade: z.string().trim().min(1).max(100),
  estado: z.string().trim().min(2).max(50),
  status: z.string().trim().max(20).optional(),
});
export const UnidadeUpdateSchema = UnidadeCreateSchema.partial();
export type UnidadeCreateDTO = z.infer<typeof UnidadeCreateSchema>;
export type UnidadeUpdateDTO = z.infer<typeof UnidadeUpdateSchema>;
