import { z } from "zod";
import { FutureOrTodayDate } from "../../../infra/shared/date-validators";

export const AlertaStatusUpdateSchema = z.object({
  status: z.enum(["ativo", "resolvido", "ignorado"]),
  motivo: z.string().max(500, { message: "Máximo de 500 caracteres." }).optional(),
});
export type AlertaStatusUpdateDTO = z.infer<typeof AlertaStatusUpdateSchema>;

export const AlertaPromoteSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, { message: "Informe o título do plano." })
    .max(150, { message: "Máximo de 150 caracteres." })
    .optional(),
  descricao: z
    .string()
    .trim()
    .min(1, { message: "Informe a descrição do plano." })
    .max(2000, { message: "Máximo de 2000 caracteres." })
    .optional(),
  prazo: FutureOrTodayDate.nullable().optional(),
  prioridade: z.enum(["baixa", "media", "alta"]).optional(),
  responsavel_id: z.string().uuid({ message: "Responsável inválido." }).nullable().optional(),
});
export type AlertaPromoteDTO = z.infer<typeof AlertaPromoteSchema>;
