import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export function errorHandler(error: Error, c: Context) {
  if (error instanceof HTTPException) {
    // HTTPException já carrega uma mensagem segura, definida explicitamente.
    return c.json({ error: error.message }, error.status);
  }
  // Erros inesperados: registrar tudo no servidor, mas nunca expor detalhes.
  // eslint-disable-next-line no-console
  console.error("[backend] unexpected error", error);
  return c.json({ error: "Erro interno" }, 500);
}