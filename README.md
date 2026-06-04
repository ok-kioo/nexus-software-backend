# `@nexus/backend` — API REST

API HTTP para o sistema Nexus. Stack: **Bun + Hono + Zod + Supabase**.

## Características

- **Clean Architecture**: `routes → controller → cases → repository → infra/database`.
- **Validação de entrada com Zod** em todos os DTOs (body, query, params), com helpers em `infra/http/validation.ts`.
- **Autenticação JWT** via Supabase Auth: o middleware `authMiddleware` lê `Authorization: Bearer <token>`, valida via `supabase.auth.getClaims`, carrega perfil + roles e injeta `auth` no contexto Hono.
- **RBAC** com 3 papéis (`administrador`, `gestor`, `professor`) e helpers `requireRole(c, [...])`.
- **RLS no banco** continua sendo a fonte de verdade; o backend usa o JWT do usuário (`userClient(c)`) para que as policies sejam aplicadas no Postgres.
- **Documentação OpenAPI** auto-gerada a partir dos schemas Zod, servida via Swagger UI em `/docs`.
- **Testes de integração** com Vitest usando `app.request()` (sem subir servidor).

## Rodando

```bash
cp .env.example .env             # preencha SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
bun install
bun run dev                      # http://localhost:3000
```

### Variáveis de ambiente

| Nome                          | Obrigatória | Descrição                                            |
| ----------------------------- | :---------: | ---------------------------------------------------- |
| `PORT`                        | não (3000)  | Porta HTTP.                                          |
| `CORS_ORIGIN`                 | não         | Origem do frontend autorizada (`http://localhost:8080` por padrão). |
| `SUPABASE_URL`                | sim         | URL do projeto Supabase.                             |
| `SUPABASE_SERVICE_ROLE_KEY`   | sim         | Chave service role (usada apenas em fluxos privilegiados). |
| `SUPABASE_PUBLISHABLE_KEY`    | sim*        | Anon key do projeto. Aceita `SUPABASE_ANON_KEY` como fallback. |
| `SUPABASE_JWKS`               | opcional    | JWKS para verificação de assinatura customizada.    |

## Estrutura

```text
src/
├── main.ts                          # bootstrap (Hono, CORS, Swagger, rotas)
├── infra/
│   ├── config/env.ts                # leitura de env vars
│   ├── database/
│   │   ├── supabase-client.ts       # createAdminClient + createUserClient
│   │   └── repositories/*           # implementações concretas dos repositórios
│   ├── http/
│   │   ├── auth-middleware.ts       # JWT + RBAC
│   │   ├── error-handler.ts         # mapeia HTTPException → JSON
│   │   ├── validation.ts            # parseJson / parseQuery / parseUuidParam
│   │   ├── openapi.ts               # spec OpenAPI (Zod → JSON)
│   │   └── request-logger.ts
│   └── shared/                      # roles, crud-factory, utils
├── modules/
│   ├── <feature>/
│   │   ├── controller/              # endpoints Hono (parsing + RBAC)
│   │   ├── cases/                   # regras de aplicação
│   │   ├── domain/                  # entity + interface do repository
│   │   └── dto/                     # schemas Zod (entrada e saída)
└── routes/                          # cada arquivo monta um controller em /v1/<x>
```

## Documentação Swagger

Após `bun run dev`, abra:

- Swagger UI: <http://localhost:3000/docs>
- Spec OpenAPI 3.1: <http://localhost:3000/docs/openapi.json>

A spec contempla autenticação `bearerAuth` (JWT) e descreve 40+ rotas agrupadas por tag.

## Testes

```bash
bun run test           # uma execução
bun run test:watch     # modo watch
```

Os testes ficam em `src/test/` e em `*.integration.test.ts`. Eles usam `app.request()` do Hono para exercitar middlewares e controllers sem abrir um socket.

## Docker

```bash
docker build -t nexus-backend .
docker run --env-file .env -p 3000:3000 nexus-backend
```

A imagem é multi-stage: builder com Bun + tsc para type-check, runtime mínimo executando `bun run src/main.ts` como usuário não-root, com `HEALTHCHECK` em `/health`.

## Resumo dos endpoints (v1)

| Prefixo                    | Tag           | Descrição                                              |
| -------------------------- | ------------- | ------------------------------------------------------ |
| `/v1/auth`                 | auth          | `/me` retorna o usuário autenticado.                   |
| `/v1/users`                | users         | Lista usuários, atualiza papel.                        |
| `/v1/invites`              | invites       | Cria/aceita convites (rotas `by-token`/`accept` públicas). |
| `/v1/unidades`, `/cursos`  | cadastros     | CRUD básico.                                           |
| `/v1/turmas`, `/alunos`    | cadastros     | CRUD com RLS por turma.                                |
| `/v1/matriculas`           | matriculas    | CRUD + `with-relations` (paginado, filtros).           |
| `/v1/frequencia`           | frequencia    | CRUD + `by-turma/:id`.                                 |
| `/v1/notas`                | notas         | CRUD.                                                  |
| `/v1/planos`               | planos        | Planos de ação.                                        |
| `/v1/avisos`               | avisos        | Mural + leituras.                                      |
| `/v1/eventos`              | eventos       | Calendário.                                            |
| `/v1/contatos`             | contatos      | Anotações por aluno.                                   |
| `/v1/alertas`              | alertas       | Lista, atualiza status, promove para plano.            |
| `/v1/auditoria`            | auditoria     | Logs (admin).                                          |
| `/v1/analytics`            | analytics     | KPIs e contagens.                                      |
| `/v1/importacao`           | importacao    | Pré-visualização e persistência de planilhas.          |
| `/v1/exportacao`           | exportacao    | Geração de relatórios.                                 |
