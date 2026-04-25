import { z } from "zod";

export const AvisoCreateSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  corpo: z.string().trim().min(1).max(5000),
  publico_alvo: z.enum(["todos", "professores", "gestores"]).optional(),
  fixado: z.boolean().optional(),
});
export const AvisoUpdateSchema = AvisoCreateSchema.partial();
export type AvisoCreateDTO = z.infer<typeof AvisoCreateSchema>;
export type AvisoUpdateDTO = z.infer<typeof AvisoUpdateSchema>;
