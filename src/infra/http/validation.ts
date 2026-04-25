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

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => {
      const path = i.path.length ? i.path.join(".") : "(root)";
      return `${path}: ${i.message}`;
    })
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
