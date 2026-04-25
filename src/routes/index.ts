import type { Hono } from "hono";
import { authMiddleware } from "../infra/http/auth-middleware";
import { authRoutes } from "./auth.routes";
import { usersRoutes } from "./users.routes";
import { invitesRoutes } from "./invites.routes";
import { unidadesRoutes } from "./unidades.routes";
import { cursosRoutes } from "./cursos.routes";
import { turmasRoutes } from "./turmas.routes";
import { alunosRoutes } from "./alunos.routes";
import { matriculasRoutes } from "./matriculas.routes";
import { frequenciaRoutes } from "./frequencia.routes";
import { notasRoutes } from "./notas.routes";
import { planosRoutes } from "./planos.routes";
import { avisosRoutes } from "./avisos.routes";
import { eventosRoutes } from "./eventos.routes";
import { contatosRoutes } from "./contatos.routes";
import { auditoriaRoutes } from "./auditoria.routes";
import { analyticsRoutes } from "./analytics.routes";
import { importacaoRoutes } from "./importacao.routes";
import { exportacaoRoutes } from "./exportacao.routes";
import { alertasRoutes } from "./alertas.routes";

/**
 * Lista canônica de rotas autenticadas. Cada item será montado em /v1/<prefix>
 * e protegido pelo authMiddleware.
 */
const AUTH_ROUTES: Array<{ prefix: string; router: Hono }> = [
  { prefix: "/v1/auth", router: authRoutes },
  { prefix: "/v1/users", router: usersRoutes },
  { prefix: "/v1/unidades", router: unidadesRoutes },
  { prefix: "/v1/cursos", router: cursosRoutes },
  { prefix: "/v1/turmas", router: turmasRoutes },
  { prefix: "/v1/alunos", router: alunosRoutes },
  { prefix: "/v1/matriculas", router: matriculasRoutes },
  { prefix: "/v1/frequencia", router: frequenciaRoutes },
  { prefix: "/v1/notas", router: notasRoutes },
  { prefix: "/v1/planos", router: planosRoutes },
  { prefix: "/v1/avisos", router: avisosRoutes },
  { prefix: "/v1/eventos", router: eventosRoutes },
  { prefix: "/v1/contatos", router: contatosRoutes },
  { prefix: "/v1/auditoria", router: auditoriaRoutes },
  { prefix: "/v1/analytics", router: analyticsRoutes },
  { prefix: "/v1/importacao", router: importacaoRoutes },
  { prefix: "/v1/exportacao", router: exportacaoRoutes },
  { prefix: "/v1/alertas", router: alertasRoutes },
];

export function registerRoutes(app: Hono) {
  // Health checks (públicos)
  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/v1/health", (c) => c.json({ ok: true }));

  // /v1/invites tem rotas públicas (by-token e accept) e protegidas
  app.use("/v1/invites", async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    const isPublic =
      (method === "GET" && path.startsWith("/v1/invites/by-token/")) ||
      (method === "POST" && path === "/v1/invites/accept");
    if (isPublic) return next();
    return authMiddleware(c, next);
  });
  app.use("/v1/invites/*", async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    const isPublic =
      (method === "GET" && path.startsWith("/v1/invites/by-token/")) ||
      (method === "POST" && path === "/v1/invites/accept");
    if (isPublic) return next();
    return authMiddleware(c, next);
  });
  app.route("/v1/invites", invitesRoutes);

  // Demais rotas: middleware + mount
  for (const { prefix, router } of AUTH_ROUTES) {
    app.use(prefix, authMiddleware);
    app.use(`${prefix}/*`, authMiddleware);
    app.route(prefix, router);
  }
}