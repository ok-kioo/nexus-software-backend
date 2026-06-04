export function cleanOrigin(origin?: string | null) {
  return (origin ?? "").replace(/\/$/, "");
}

export function parsePage(value: string | undefined, fallback = 1) {
  return Math.max(1, Number(value ?? String(fallback)));
}

export function parsePageSize(value: string | undefined, fallback = 20, max = 200) {
  return Math.min(max, Math.max(1, Number(value ?? String(fallback))));
}