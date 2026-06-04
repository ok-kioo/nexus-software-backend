/**
 * parity-check.ts
 *
 * Compara contagens de cada entidade entre o caminho Supabase direto e a API Nexus,
 * usando o mesmo JWT. Saída JSON em stdout. Use em CI antes do cutover.
 *
 * Variáveis necessárias:
 *  - SUPABASE_URL
 *  - SUPABASE_ANON_KEY
 *  - API_URL          (ex.: http://localhost:3000)
 *  - JWT              (token do usuário admin, mesmo usado pelo smoke)
 */

const ENTITIES = [
  "unidades",
  "cursos",
  "turmas",
  "alunos",
  "matriculas",
  "frequencia",
  "notas",
] as const;

const env = process.env;
const SUPABASE_URL = env.SUPABASE_URL ?? "";
const ANON = env.SUPABASE_ANON_KEY ?? "";
const API_URL = env.API_URL ?? "http://localhost:3000";
const JWT = env.JWT ?? "";

if (!SUPABASE_URL || !ANON || !JWT) {
  console.error(JSON.stringify({ ok: false, error: "missing SUPABASE_URL/SUPABASE_ANON_KEY/JWT" }));
  process.exit(1);
}

async function countDirect(entity: string): Promise<number> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${entity}?select=id`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${JWT}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const range = r.headers.get("content-range") ?? "0-0/0";
  return Number(range.split("/")[1] ?? 0);
}

async function countApi(entity: string): Promise<number> {
  const r = await fetch(`${API_URL}/v1/${entity}?pageSize=1&page=1`, {
    headers: { Authorization: `Bearer ${JWT}` },
  });
  if (!r.ok) return -1;
  const j = (await r.json()) as { total?: number };
  return Number(j.total ?? 0);
}

(async () => {
  const results = await Promise.all(
    ENTITIES.map(async (e) => {
      const [direct, api] = await Promise.all([countDirect(e), countApi(e)]);
      return { entity: e, direct, api, ok: direct === api };
    }),
  );
  const allOk = results.every((r) => r.ok);
  console.log(JSON.stringify({ ok: allOk, results }, null, 2));
  process.exit(allOk ? 0 : 1);
})();