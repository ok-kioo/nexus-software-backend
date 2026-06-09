import type { Context, Next } from "hono";

/**
 * Headers de segurança aplicados a todas as respostas.
 * HSTS/CSP devem ser configurados na camada de borda (nginx/CDN).
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (c.req.path.startsWith("/v1/capelo")) {
    c.header("Cache-Control", "no-store");
  }
}
