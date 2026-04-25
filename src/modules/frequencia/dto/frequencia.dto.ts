import { z } from "zod";

export const FrequenciaCreateSchema = z.object({
  matricula_id: z.string().uuid(),
  data: z.string(),
  presente: z.boolean(),
  observacao: z.string().nullable().optional(),
  registrado_por: z.string().uuid().nullable().optional(),
});
export const FrequenciaUpdateSchema = FrequenciaCreateSchema.partial();
export type FrequenciaCreateDTO = z.infer<typeof FrequenciaCreateSchema>;