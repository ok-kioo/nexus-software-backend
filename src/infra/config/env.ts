function parseOrigins(value: string | undefined, fallback: string): string[] {
  const raw = (value ?? fallback)
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return Array.from(new Set(raw));
}

const allowedOrigins = parseOrigins(
  process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGIN,
  "http://localhost:8080",
);

export const config = {
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:8080",
  allowedOrigins,
  appBaseUrl: (process.env.APP_BASE_URL ?? allowedOrigins[0] ?? "http://localhost:8080").replace(/\/$/, ""),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  // Capelo / n8n
  n8nCapeloUrl:
    process.env.N8N_CAPELO_URL ??
    "http://localhost:5678/webhook/647a7bde-b944-4d1d-bd2a-ae04e7ee4d2a/chat",
  // Rate limiting (in-memory, single-instance)
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 120),
  rateLimitCapeloMax: Number(process.env.RATE_LIMIT_CAPELO_MAX ?? 20),
};

export function requireEnv(name: keyof typeof config) {
  const value = config[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

/**
 * Returns the request origin if it is in the allowlist, otherwise the
 * configured app base URL. Use this before embedding an origin into emails
 * or redirect URLs to prevent open-redirect/phishing via the Origin header.
 */
export function safeOrigin(origin?: string | null): string {
  const normalized = (origin ?? "").replace(/\/$/, "");
  if (normalized && config.allowedOrigins.includes(normalized)) {
    return normalized;
  }
  return config.appBaseUrl;
}