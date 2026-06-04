import { z } from "zod";
import { IsoDateString } from "../../../infra/shared/date-validators";

const baseShape = {
  aluno_id: z.string().uuid({ message: "Aluno inválido." }),
  turma_id: z.string().uuid({ message: "Turma inválida." }),
  numero_matricula: z
    .string()
    .trim()
    .min(1, { message: "Informe o número da matrícula." })
    .max(50, { message: "Máximo de 50 caracteres." }),
  data_inicio: IsoDateString.nullable().optional(),
  data_fim: IsoDateString.nullable().optional(),
  status: z.string().trim().max(20).optional(),
};

function checkRange(
  val: { data_inicio?: string | null; data_fim?: string | null },
  ctx: z.RefinementCtx,
) {
  if (val.data_inicio && val.data_fim && val.data_fim < val.data_inicio) {
    ctx.addIssue({
      code: "custom",
      path: ["data_fim"],
      message: "A data final deve ser igual ou posterior à data de início.",
    });
  }
}

export const MatriculaCreateSchema = z.object(baseShape).superRefine(checkRange);
export const MatriculaUpdateSchema = z
  .object({
    aluno_id: baseShape.aluno_id.optional(),
    turma_id: baseShape.turma_id.optional(),
    numero_matricula: baseShape.numero_matricula.optional(),
    data_inicio: baseShape.data_inicio,
    data_fim: baseShape.data_fim,
    status: baseShape.status,
  })
  .superRefine(checkRange);
export type MatriculaCreateDTO = z.infer<typeof MatriculaCreateSchema>;
export type MatriculaUpdateDTO = z.infer<typeof MatriculaUpdateSchema>;
