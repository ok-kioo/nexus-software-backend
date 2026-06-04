import { HTTPException } from "hono/http-exception";

/**
 * Mapa de códigos PostgreSQL/Supabase para mensagens seguras ao cliente.
 * O erro original é sempre logado server-side, nunca exposto na resposta.
 */
const PG_CODE_MESSAGES: Record<string, { status: 400 | 403 | 404 | 409 | 500; message: string }> = {
  "23505": { status: 409, message: "Registro duplicado" },
  "23503": { status: 400, message: "Referência inválida para outro registro" },
  "23502": { status: 400, message: "Campo obrigatório ausente" },
  "23514": { status: 400, message: "Dados violam regra de validação" },
  "22P02": { status: 400, message: "Formato de dado inválido" },
  "42501": { status: 403, message: "Sem permissão para esta operação" },
  PGRST116: { status: 404, message: "Registro não encontrado" },
};

interface MaybePgError {
  code?: string;
  message?: string;
  status?: number;
  hint?: string;
  details?: string;
}

/**
 * Converte um erro do Supabase/Postgres em HTTPException seguro.
 * Loga o erro completo no servidor; nunca expõe `message` cru ao cliente.
 */
export function dbError(error: unknown, fallbackStatus: 400 | 500 = 500): HTTPException {
  const err = (error ?? {}) as MaybePgError;
  // eslint-disable-next-line no-console
  console.error("[backend][db-error]", {
    code: err.code,
    message: err.message,
    hint: err.hint,
    details: err.details,
  });

  if (err.code && PG_CODE_MESSAGES[err.code]) {
    const mapped = PG_CODE_MESSAGES[err.code];
    return new HTTPException(mapped.status, { message: mapped.message });
  }

  if (fallbackStatus === 400) {
    return new HTTPException(400, { message: "Não foi possível processar a requisição" });
  }
  return new HTTPException(500, { message: "Erro interno ao acessar o banco de dados" });
}

/**
 * Lança HTTPException segura se `error` não for nulo.
 */
export function assertNoDbError(error: unknown, fallbackStatus: 400 | 500 = 500): void {
  if (error) throw dbError(error, fallbackStatus);
}