import type { Context, Next } from "hono";

export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const auth = c.get("auth") as { user?: { id: string } } | undefined;
  const userId = auth?.user?.id ?? "anon";
  // eslint-disable-next-line no-console
  console.log(`[req] ${c.req.method} ${c.req.path} -> ${c.res.status} ${ms}ms user=${userId}`);
}