import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuth, requireRole, userClient } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { alertaRepository } from "../domain/alerta.repository";
import { snapshotAlertasCase } from "../cases/snapshot-alertas.case";
import { listAlertasCase, getAlertaDetailCase } from "../cases/list-alertas.case";
import { updateAlertaStatusCase } from "../cases/update-alerta-status.case";
import { promoteAlertaToPlanoCase } from "../cases/promote-to-plano.case";
import { AlertaPromoteSchema, AlertaStatusUpdateSchema } from "../dto/alerta.dto";
import type { AlertaStatus } from "../domain/alerta.entity";

export function alertaController(): Hono {
  const router = new Hono();

  /**
   * GET /v1/alertas
   * Recomputa snapshots (apenas para admin/gestor — professor não escreve)
   * e retorna a lista filtrada por status (default: todos).
   */
  router.get("/", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const { user } = getAuth(c);
    const client = userClient(c);
    const status = (c.req.query("status") as AlertaStatus | undefined) || undefined;
    const refresh = c.req.query("refresh") !== "false";

    // Apenas admin/gestor podem disparar o snapshot (RLS bloqueia INSERT/UPDATE p/ professor)
    if (refresh && (user.role === "administrador" || user.role === "gestor")) {
      try {
        await snapshotAlertasCase(alertaRepository, client, user.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[alertas][snapshot] falhou — devolvendo lista atual", err);
      }
    }
    const rows = await listAlertasCase(alertaRepository, client, { status });
    return c.json({ rows, total: rows.length });
  });

  /** GET /v1/alertas/:id — detalhe + histórico */
  router.get("/:id", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const id = c.req.param("id");
    const data = await getAlertaDetailCase(alertaRepository, userClient(c), id);
    if (!data.alerta) throw new HTTPException(404, { message: "Alerta não encontrado" });
    return c.json(data);
  });

  /** PATCH /v1/alertas/:id — atualizar status (resolvido/ignorado/ativo) */
  router.patch("/:id", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = AlertaStatusUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const updated = await updateAlertaStatusCase(
      alertaRepository,
      userClient(c),
      c.req.param("id"),
      parsed.data.status,
      user.id,
    );
    if (!updated) throw new HTTPException(404, { message: "Alerta não encontrado" });
    return c.json(updated);
  });

  /** POST /v1/alertas/:id/promote — gera plano de ação */
  router.post("/:id/promote", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = AlertaPromoteSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const result = await promoteAlertaToPlanoCase(
      alertaRepository,
      userClient(c),
      c.req.param("id"),
      parsed.data,
      user.id,
    );
    return c.json(result, 201);
  });

  return router;
}