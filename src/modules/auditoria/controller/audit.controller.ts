import { Hono } from "hono";
import { requireRole } from "../../../infra/http/auth-middleware";
import { ADMIN_ONLY } from "../../../infra/shared/roles";
import { auditLogRepository } from "../domain/audit-log.repository";
import { listAuditCase } from "../cases/list-audit.case";

export function auditController(): Hono {
  const router = new Hono();
  router.get("/", async (c) => {
    requireRole(c, ADMIN_ONLY);
    const rows = (await listAuditCase(auditLogRepository, {
      entidade: c.req.query("entidade"),
      acao: c.req.query("acao"),
      user_id: c.req.query("user_id"),
      limit: Number(c.req.query("limit") ?? "500"),
    })) as unknown[];
    return c.json({ rows, total: rows.length });
  });
  return router;
}