import { z } from "zod";
import { FutureOrTodayDate, IsoDateString } from "../../../infra/shared/date-validators";

export const EventoCreateSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(1, { message: "Informe o título do evento." })
      .max(200, { message: "Máximo de 200 caracteres." }),
    descricao: z
      .string()
      .trim()
      .max(2000, { message: "Máximo de 2000 caracteres." })
      .nullable()
      .optional(),
    tipo: z.string().trim().max(50).optional(),
    data_inicio: FutureOrTodayDate,
    data_fim: IsoDateString.nullable().optional(),
    unidade_id: z.string().uuid({ message: "Unidade inválida." }).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.data_fim && val.data_fim < val.data_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["data_fim"],
        message: "A data final deve ser igual ou posterior à data de início.",
      });
    }
  });
export const EventoUpdateSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200).optional(),
    descricao: z.string().trim().max(2000).nullable().optional(),
    tipo: z.string().trim().max(50).optional(),
    data_inicio: FutureOrTodayDate.optional(),
    data_fim: IsoDateString.nullable().optional(),
    unidade_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.data_inicio && val.data_fim && val.data_fim < val.data_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["data_fim"],
        message: "A data final deve ser igual ou posterior à data de início.",
      });
    }
  });
export type EventoCreateDTO = z.infer<typeof EventoCreateSchema>;
export type EventoUpdateDTO = z.infer<typeof EventoUpdateSchema>;
