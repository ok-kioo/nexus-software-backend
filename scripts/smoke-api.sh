#!/usr/bin/env bash
# Smoke test do backend Nexus (Waves 1 + 2).
# Uso:
#   API_URL=http://localhost:3000 TOKEN="<jwt-do-supabase>" ./scripts/smoke-wave1.sh
#
# Como obter o TOKEN:
#   1. Faça login no preview do frontend.
#   2. No DevTools, rode:
#        JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('sb-')))).access_token
#   3. Cole o valor em TOKEN.

set -euo pipefail
API_URL="${API_URL:-http://localhost:3000}"
TOKEN="${TOKEN:-}"

call() {
  local label="$1"; shift
  echo "==> ${label}"
  curl -sS "$@" | head -c 400
  echo; echo
}

call "GET /v1/health" "${API_URL}/v1/health"

if [[ -z "$TOKEN" ]]; then
  echo "TOKEN ausente — pulando rotas autenticadas."
  exit 0
fi

AUTH=(-H "Authorization: Bearer ${TOKEN}")

# Wave 1
call "GET /v1/auth/me"   "${AUTH[@]}" "${API_URL}/v1/auth/me"
call "GET /v1/users"     "${AUTH[@]}" "${API_URL}/v1/users"

# Wave 2 - cadastros
call "GET /v1/unidades"          "${AUTH[@]}" "${API_URL}/v1/unidades?pageSize=5"
call "GET /v1/cursos"            "${AUTH[@]}" "${API_URL}/v1/cursos?pageSize=5"
call "GET /v1/turmas"            "${AUTH[@]}" "${API_URL}/v1/turmas?pageSize=5"
call "GET /v1/turmas/with-relations" "${AUTH[@]}" "${API_URL}/v1/turmas/with-relations"
call "GET /v1/alunos"            "${AUTH[@]}" "${API_URL}/v1/alunos?pageSize=5"

# Wave 2 - matrículas
call "GET /v1/matriculas"                  "${AUTH[@]}" "${API_URL}/v1/matriculas?pageSize=5"
call "GET /v1/matriculas/with-relations"   "${AUTH[@]}" "${API_URL}/v1/matriculas/with-relations?pageSize=5"

# Wave 3 - acadêmico
call "GET /v1/frequencia"   "${AUTH[@]}" "${API_URL}/v1/frequencia?pageSize=5"
call "GET /v1/notas"        "${AUTH[@]}" "${API_URL}/v1/notas?pageSize=5"
call "GET /v1/planos"       "${AUTH[@]}" "${API_URL}/v1/planos"
call "GET /v1/avisos"       "${AUTH[@]}" "${API_URL}/v1/avisos"
call "GET /v1/avisos/leituras" "${AUTH[@]}" "${API_URL}/v1/avisos/leituras"
call "GET /v1/eventos"      "${AUTH[@]}" "${API_URL}/v1/eventos"
call "GET /v1/auditoria"    "${AUTH[@]}" "${API_URL}/v1/auditoria?limit=5"

# Wave 3 - analytics composto
call "GET /v1/analytics/base"                 "${AUTH[@]}" "${API_URL}/v1/analytics/base"
call "GET /v1/analytics/turmas-do-professor"  "${AUTH[@]}" "${API_URL}/v1/analytics/turmas-do-professor"

# Wave 4 - exportação
call "GET /v1/exportacao/matriculas"  "${AUTH[@]}" "${API_URL}/v1/exportacao/matriculas"
call "GET /v1/exportacao/turmas"      "${AUTH[@]}" "${API_URL}/v1/exportacao/turmas"
call "GET /v1/exportacao/academico"   "${AUTH[@]}" "${API_URL}/v1/exportacao/academico"
call "GET /v1/exportacao/permanencia" "${AUTH[@]}" "${API_URL}/v1/exportacao/permanencia"

# Wave 4 - importação (preview com payload mínimo)
call "POST /v1/importacao/preview" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -X POST -d '{"entity":"unidades","rows":[]}' \
  "${API_URL}/v1/importacao/preview"

echo "Smoke OK."
