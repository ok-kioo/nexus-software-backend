import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z, type ZodTypeAny } from "zod";

/**
 * Validation helpers — padronizam erros 400 com lista completa dos issues
 * (path + message), e centralizam o parsing de body / query / params.
 *
 * Use estes helpers em vez de `safeParse` direto nos controllers para garantir
 * mensagens de erro consistentes e previsíveis no front.
 */

const FIELD_LABELS: Record<string, string> = {
  titulo: "Título",
  descricao: "Descrição",
  nome: "Nome",
  nome_aluno: "Nome do aluno",
  nome_turma: "Nome da turma",
  nome_curso: "Nome do curso",
  nome_unidade: "Nome da unidade",
  email: "E-mail",
  telefone: "Telefone",
  documento: "Documento",
  data_nascimento: "Data de nascimento",
  data_inicio: "Data de início",
  data_fim: "Data final",
  prazo: "Prazo",
  prioridade: "Prioridade",
  status: "Status",
  aluno_id: "Aluno",
  turma_id: "Turma",
  curso_id: "Curso",
  unidade_id: "Unidade",
  responsavel_id: "Responsável",
  numero_matricula: "Número da matrícula",
  motivo: "Motivo",
  corpo: "Corpo",
  tipo: "Tipo",
  cidade: "Cidade",
  estado: "Estado",
  categoria: "Categoria",
  observacao: "Observação",
  password: "Senha",
  currentPassword: "Senha atual",
  newPassword: "Nova senha",
  role: "Papel",
};

function labelFor(path: (string | number)[]): string {
  if (!path.length) return "Campo";
  const key = String(path[path.length - 1]);
  return FIELD_LABELS[key] ?? key;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${labelFor(i.path as (string | number)[])}: ${i.message}`)
    .join("; ");
}

export async function parseJson<S extends ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatIssues(parsed.error) });
  }
  return parsed.data;
}

export function parseQuery<S extends ZodTypeAny>(c: Context, schema: S): z.infer<S> {
  const raw = c.req.query();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatIssues(parsed.error) });
  }
  return parsed.data;
}

const UuidSchema = z.string().uuid({ message: "id deve ser UUID" });

export function parseUuidParam(c: Context, name = "id"): string {
  const value = c.req.param(name);
  const parsed = UuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new HTTPException(400, { message: `${name}: ${parsed.error.issues[0]?.message ?? "inválido"}` });
  }
  return parsed.data;
}

/** Schemas reutilizáveis para query params comuns. */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const DateRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
