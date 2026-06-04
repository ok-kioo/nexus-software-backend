import { z } from "zod";
import { PastOrTodayDate } from "../../../infra/shared/date-validators";

export const AlunoCreateSchema = z.object({
  nome_aluno: z
    .string()
    .trim()
    .min(1, { message: "Informe o nome do aluno." })
    .max(150, { message: "Máximo de 150 caracteres." }),
  documento: z
    .string()
    .trim()
    .min(1, { message: "Informe o documento do aluno." })
    .max(50, { message: "Máximo de 50 caracteres." }),
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido." })
    .max(255)
    .nullable()
    .optional(),
  telefone: z.string().trim().max(30).nullable().optional(),
  data_nascimento: PastOrTodayDate.nullable().optional(),
  status: z.string().trim().max(20).optional(),
});
export const AlunoUpdateSchema = AlunoCreateSchema.partial();
export type AlunoCreateDTO = z.infer<typeof AlunoCreateSchema>;
export type AlunoUpdateDTO = z.infer<typeof AlunoUpdateSchema>;
