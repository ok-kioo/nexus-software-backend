import { z } from "zod";
import { FutureOrTodayDate } from "../../../infra/shared/date-validators";

export const PlanoCreateSchema = z.object({
  aluno_id: z.string().uuid({ message: "Selecione um aluno válido." }),
  titulo: z
    .string({ message: "Informe o título do plano." })
    .trim()
    .min(1, { message: "Informe o título do plano." })
    .max(200, { message: "Máximo de 200 caracteres." }),
  descricao: z
    .string({ message: "Informe a descrição do plano." })
    .trim()
    .min(1, { message: "Informe a descrição do plano." })
    .max(2000, { message: "Máximo de 2000 caracteres." }),
  prioridade: z.enum(["baixa", "media", "alta"]).optional(),
  status: z.enum(["aberto", "em_andamento", "concluido", "cancelado"]).optional(),
  responsavel_id: z.string().uuid({ message: "Responsável inválido." }).nullable().optional(),
  prazo: FutureOrTodayDate.nullable().optional(),
  origem_alerta: z.string().trim().max(150).nullable().optional(),
});
export const PlanoUpdateSchema = PlanoCreateSchema.partial();
export type PlanoCreateDTO = z.infer<typeof PlanoCreateSchema>;
export type PlanoUpdateDTO = z.infer<typeof PlanoUpdateSchema>;
