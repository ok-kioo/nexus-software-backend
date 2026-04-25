import { z } from "zod";

export const NotaCreateSchema = z.object({
  matricula_id: z.string().uuid(),
  nota_1: z.number().nullable().optional(),
  nota_2: z.number().nullable().optional(),
  nota_3: z.number().nullable().optional(),
  nota_4: z.number().nullable().optional(),
  observacao: z.string().nullable().optional(),
  registrado_por: z.string().uuid().nullable().optional(),
});
export const NotaUpdateSchema = NotaCreateSchema.partial();
export type NotaCreateDTO = z.infer<typeof NotaCreateSchema>;