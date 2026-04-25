import { z } from "zod";
import { createDocument, type ZodOpenApiOperationObject, type ZodOpenApiPathsObject } from "zod-openapi";

import { AvisoCreateSchema, AvisoUpdateSchema } from "../../modules/avisos/dto/aviso.dto";
import { ContatoCreateSchema } from "../../modules/contatos/dto/contato.dto";
import { EventoCreateSchema, EventoUpdateSchema } from "../../modules/eventos/dto/evento.dto";
import { CursoCreateSchema, CursoUpdateSchema } from "../../modules/cursos/dto/curso.dto";
import { AlunoCreateSchema, AlunoUpdateSchema } from "../../modules/alunos/dto/aluno.dto";
import { TurmaCreateSchema, TurmaUpdateSchema } from "../../modules/turmas/dto/turma.dto";
import { UnidadeCreateSchema, UnidadeUpdateSchema } from "../../modules/unidades/dto/unidade.dto";
import { MatriculaCreateSchema, MatriculaUpdateSchema } from "../../modules/matriculas/dto/matricula.dto";
import { PlanoCreateSchema, PlanoUpdateSchema } from "../../modules/planos/dto/plano.dto";
import { FrequenciaCreateSchema, FrequenciaUpdateSchema } from "../../modules/frequencia/dto/frequencia.dto";
import { NotaCreateSchema, NotaUpdateSchema } from "../../modules/notas/dto/nota.dto";
import {
  InviteCreateSchema,
  InviteResendSchema,
  AcceptInviteSchema,
} from "../../modules/invites/dto/invite.dto";
import { AlertaPromoteSchema, AlertaStatusUpdateSchema } from "../../modules/alertas/dto/alerta.dto";
import { UpdateRoleSchema } from "../../modules/users/dto/user.dto";

/** Resposta de erro padronizada do backend. */
const ErrorResponse = z.object({ error: z.string() });
const OkResponse = z.object({ ok: z.boolean() });
const ListResponse = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  total: z.number(),
});

const errorResponses = {
  "400": { description: "Payload inválido", content: { "application/json": { schema: ErrorResponse } } },
  "401": { description: "Não autenticado", content: { "application/json": { schema: ErrorResponse } } },
  "403": { description: "Sem permissão", content: { "application/json": { schema: ErrorResponse } } },
  "404": { description: "Não encontrado", content: { "application/json": { schema: ErrorResponse } } },
};

const security = [{ bearerAuth: [] as string[] }];
const publicSecurity: Array<Record<string, string[]>> = [];

function listOp(tag: string, summary: string): ZodOpenApiOperationObject {
  return {
    tags: [tag],
    summary,
    security,
    responses: {
      "200": { description: "OK", content: { "application/json": { schema: ListResponse } } },
      ...errorResponses,
    },
  };
}

function createOp(tag: string, schema: z.ZodTypeAny, summary: string): ZodOpenApiOperationObject {
  return {
    tags: [tag],
    summary,
    security,
    requestBody: { required: true, content: { "application/json": { schema } } },
    responses: {
      "201": { description: "Criado", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
      ...errorResponses,
    },
  };
}

function updateOp(tag: string, schema: z.ZodTypeAny, summary: string): ZodOpenApiOperationObject {
  return {
    tags: [tag],
    summary,
    security,
    requestParams: { path: z.object({ id: z.string().uuid() }) },
    requestBody: { required: true, content: { "application/json": { schema } } },
    responses: {
      "200": { description: "Atualizado", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
      ...errorResponses,
    },
  };
}

function deleteOp(tag: string, summary: string): ZodOpenApiOperationObject {
  return {
    tags: [tag],
    summary,
    security,
    requestParams: { path: z.object({ id: z.string().uuid() }) },
    responses: {
      "200": { description: "Removido", content: { "application/json": { schema: OkResponse } } },
      ...errorResponses,
    },
  };
}

function crudPaths(tag: string, base: string, create: z.ZodTypeAny, update: z.ZodTypeAny): ZodOpenApiPathsObject {
  return {
    [base]: {
      get: listOp(tag, `Lista ${tag}`),
      post: createOp(tag, create, `Cria ${tag}`),
    },
    [`${base}/{id}`]: {
      patch: updateOp(tag, update, `Atualiza ${tag}`),
      delete: deleteOp(tag, `Remove ${tag}`),
    },
  };
}

const paths: ZodOpenApiPathsObject = {
  "/health": {
    get: {
      tags: ["health"],
      summary: "Health check",
      security: publicSecurity,
      responses: { "200": { description: "OK" } },
    },
  },
  "/v1/health": {
    get: {
      tags: ["health"],
      summary: "Health check (v1)",
      security: publicSecurity,
      responses: { "200": { description: "OK" } },
    },
  },

  // Auth
  "/v1/auth/me": {
    get: {
      tags: ["auth"],
      summary: "Retorna usuário autenticado",
      security,
      responses: {
        "200": { description: "Usuário", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
        ...errorResponses,
      },
    },
  },

  // Users
  "/v1/users": { get: listOp("users", "Lista usuários com papéis") },
  "/v1/users/{id}/role": {
    patch: {
      tags: ["users"],
      summary: "Atualiza papel do usuário",
      security,
      requestParams: { path: z.object({ id: z.string().uuid() }) },
      requestBody: { required: true, content: { "application/json": { schema: UpdateRoleSchema } } },
      responses: {
        "200": { description: "Atualizado", content: { "application/json": { schema: OkResponse } } },
        ...errorResponses,
      },
    },
  },

  // Invites — públicas + protegidas
  "/v1/invites": {
    get: listOp("invites", "Lista convites do solicitante"),
    post: createOp("invites", InviteCreateSchema, "Cria convite"),
  },
  "/v1/invites/by-token/{token}": {
    get: {
      tags: ["invites"],
      summary: "Lê convite por token (público)",
      security: publicSecurity,
      requestParams: { path: z.object({ token: z.string().uuid() }) },
      responses: {
        "200": { description: "Convite", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
        ...errorResponses,
      },
    },
  },
  "/v1/invites/accept": {
    post: {
      tags: ["invites"],
      summary: "Aceita convite (público)",
      security: publicSecurity,
      requestBody: { required: true, content: { "application/json": { schema: AcceptInviteSchema } } },
      responses: { "200": { description: "OK" }, ...errorResponses },
    },
  },
  "/v1/invites/resend": {
    post: {
      tags: ["invites"],
      summary: "Reenvia convite",
      security,
      requestBody: { required: true, content: { "application/json": { schema: InviteResendSchema } } },
      responses: { "200": { description: "OK" }, ...errorResponses },
    },
  },

  // CRUD modules
  ...crudPaths("unidades", "/v1/unidades", UnidadeCreateSchema, UnidadeUpdateSchema),
  ...crudPaths("cursos", "/v1/cursos", CursoCreateSchema, CursoUpdateSchema),
  ...crudPaths("turmas", "/v1/turmas", TurmaCreateSchema, TurmaUpdateSchema),
  ...crudPaths("alunos", "/v1/alunos", AlunoCreateSchema, AlunoUpdateSchema),
  ...crudPaths("matriculas", "/v1/matriculas", MatriculaCreateSchema, MatriculaUpdateSchema),
  ...crudPaths("frequencia", "/v1/frequencia", FrequenciaCreateSchema, FrequenciaUpdateSchema),
  ...crudPaths("notas", "/v1/notas", NotaCreateSchema, NotaUpdateSchema),
  ...crudPaths("planos", "/v1/planos", PlanoCreateSchema, PlanoUpdateSchema),
  ...crudPaths("avisos", "/v1/avisos", AvisoCreateSchema, AvisoUpdateSchema),
  ...crudPaths("eventos", "/v1/eventos", EventoCreateSchema, EventoUpdateSchema),

  // Endpoints específicos
  "/v1/matriculas/with-relations": {
    get: {
      tags: ["matriculas"],
      summary: "Matrículas com relações + filtros",
      security,
      requestParams: {
        query: z.object({
          page: z.coerce.number().int().optional(),
          pageSize: z.coerce.number().int().optional(),
          search: z.string().optional(),
          status: z.string().optional(),
          dataInicio: z.string().optional(),
          dataFim: z.string().optional(),
          unidadeId: z.string().uuid().optional(),
          cursoId: z.string().uuid().optional(),
          turmaId: z.string().uuid().optional(),
        }),
      },
      responses: {
        "200": { description: "OK", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
        ...errorResponses,
      },
    },
  },
  "/v1/frequencia/by-turma/{turmaId}": {
    get: {
      tags: ["frequencia"],
      summary: "Frequência por turma",
      security,
      requestParams: {
        path: z.object({ turmaId: z.string().uuid() }),
        query: z.object({ from: z.string().optional(), to: z.string().optional() }),
      },
      responses: { "200": { description: "OK" }, ...errorResponses },
    },
  },
  "/v1/contatos": {
    get: listOp("contatos", "Lista contatos"),
    post: createOp("contatos", ContatoCreateSchema, "Cria contato"),
  },
  "/v1/contatos/{id}": { delete: deleteOp("contatos", "Remove contato") },

  // Alertas
  "/v1/alertas": {
    get: {
      tags: ["alertas"],
      summary: "Lista alertas (snapshot recomputado para admin/gestor)",
      security,
      requestParams: {
        query: z.object({ status: z.enum(["ativo", "resolvido", "ignorado"]).optional(), refresh: z.string().optional() }),
      },
      responses: { "200": { description: "OK", content: { "application/json": { schema: ListResponse } } }, ...errorResponses },
    },
  },
  "/v1/alertas/{id}": {
    get: {
      tags: ["alertas"],
      summary: "Detalhe + histórico",
      security,
      requestParams: { path: z.object({ id: z.string().uuid() }) },
      responses: { "200": { description: "OK" }, ...errorResponses },
    },
    patch: {
      tags: ["alertas"],
      summary: "Atualiza status do alerta",
      security,
      requestParams: { path: z.object({ id: z.string().uuid() }) },
      requestBody: { required: true, content: { "application/json": { schema: AlertaStatusUpdateSchema } } },
      responses: { "200": { description: "OK" }, ...errorResponses },
    },
  },
  "/v1/alertas/{id}/promote": {
    post: {
      tags: ["alertas"],
      summary: "Promove alerta para plano de ação",
      security,
      requestParams: { path: z.object({ id: z.string().uuid() }) },
      requestBody: { required: true, content: { "application/json": { schema: AlertaPromoteSchema } } },
      responses: { "201": { description: "Plano criado" }, ...errorResponses },
    },
  },

  // Analytics / Auditoria / Importação / Exportação (resumido)
  "/v1/analytics/turmas-counts": { get: listOp("analytics", "Contagens por turma") },
  "/v1/auditoria": { get: listOp("auditoria", "Lista logs de auditoria") },
  "/v1/importacao/preview": {
    post: {
      tags: ["importacao"],
      summary: "Pré-visualiza importação de planilha",
      security,
      responses: { "200": { description: "OK" }, ...errorResponses },
    },
  },
  "/v1/exportacao/relatorio": {
    get: {
      tags: ["exportacao"],
      summary: "Gera relatório (PDF/Excel)",
      security,
      responses: { "200": { description: "Arquivo" }, ...errorResponses },
    },
  },
};

export const openapiDocument = createDocument({
  openapi: "3.1.0",
  info: {
    title: "Nexus API",
    version: "1.0.0",
    description:
      "API REST do sistema Nexus para gestão acadêmica (cursos, turmas, alunos, matrículas, frequência, notas, planos de ação, avisos, alertas, etc.).",
  },
  servers: [{ url: "http://localhost:3000", description: "Local" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  tags: [
    { name: "health" },
    { name: "auth" },
    { name: "users" },
    { name: "invites" },
    { name: "unidades" },
    { name: "cursos" },
    { name: "turmas" },
    { name: "alunos" },
    { name: "matriculas" },
    { name: "frequencia" },
    { name: "notas" },
    { name: "planos" },
    { name: "avisos" },
    { name: "eventos" },
    { name: "contatos" },
    { name: "alertas" },
    { name: "auditoria" },
    { name: "analytics" },
    { name: "importacao" },
    { name: "exportacao" },
  ],
  paths,
});
