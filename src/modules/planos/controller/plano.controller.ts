import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole, userClient } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES, ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { PlanoCreateSchema, PlanoUpdateSchema } from "../dto/plano.dto";
import { planoRepository } from "../domain/plano.repository";
import { listPlanosCase } from "../cases/list-planos.case";
import { createPlanoCase } from "../cases/create-plano.case";
import { updatePlanoCase } from "../cases/update-plano.case";
import { deletePlanoCase } from "../cases/delete-plano.case";

export function planoController(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const rows = (await listPlanosCase(planoRepository, userClient(c))) as unknown[];
    return c.json({ rows, total: rows.length });
  });

  router.post("/", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = PlanoCreateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    const data = await createPlanoCase(planoRepository, userClient(c), parsed.data, user.id);
    return c.json(data, 201);
  });

  router.patch("/:id", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const parsed = PlanoUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    const data = await updatePlanoCase(planoRepository, userClient(c), c.req.param("id"), parsed.data);
    if (!data) throw new HTTPException(404, { message: "Não encontrado" });
    return c.json(data);
  });

  router.delete("/:id", async (c) => {
    requireRole(c, ADMIN_ONLY);
    await deletePlanoCase(planoRepository, userClient(c), c.req.param("id"));
    return c.json({ ok: true });
  });

  return router;
}