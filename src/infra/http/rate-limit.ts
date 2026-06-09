import type { Context, MiddlewareHandler, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthContextValue } from "../shared/types";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Limpeza periódica em background (evita memory leak).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Não impedir o processo de encerrar (em testes/CI).
  if (typeof cleanupTimer === "object" && cleanupTimer && "unref" in cleanupTimer) {
    (cleanupTimer as unknown as { unref: () => void }).unref();
  }
}

function clientKey(c: Context, scope: string): string {
  const auth = c.get("auth") as AuthContextValue | undefined;
  if (auth?.user?.id) return `${scope}:u:${auth.user.id}`;
  const fwd = c.req.header("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || c.req.header("x-real-ip") || "anon";
  return `${scope}:ip:${ip}`;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  scope?: string;
  skip?: (c: Context) => boolean;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  ensureCleanup();
  const scope = opts.scope ?? "global";
  return async (c: Context, next: Next) => {
    if (opts.skip?.(c)) return next();

    // Excluir health/docs do limiter.
    const path = c.req.path;
    if (path === "/health" || path === "/v1/health" || path.startsWith("/docs")) {
      return next();
    }
    if (c.req.method === "OPTIONS") return next();

    const key = clientKey(c, scope);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    if (bucket.count >= opts.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      throw new HTTPException(429, {
        message: `Muitas requisições. Tente novamente em ${retryAfter}s.`,
      });
    }

    bucket.count += 1;
    return next();
  };
}

// Exportado para testes.
export function __resetRateLimit() {
  buckets.clear();
}
