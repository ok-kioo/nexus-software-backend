import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuth, requireRole } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES } from "../../../infra/shared/roles";
import { AvisoCreateSchema, AvisoUpdateSchema } from "../dto/aviso.dto";
import { avisoRepository } from "../domain/aviso.repository";
import {
  createAvisoCase,
  deleteAvisoCase,
  listAvisosCase,
  listLeiturasCase,
  markReadCase,
  updateAvisoCase,
} from "../cases/aviso.cases";

export function avisoController(): Hono {
  const router = new Hono();

  router.get("/leituras", async (c) => {
    const { user } = getAuth(c);
    const rows = await listLeiturasCase(avisoRepository, user.id);
    return c.json({ rows });
  });

  router.post("/leituras", async (c) => {
    const { user } = getAuth(c);
    const body = await c.req.json().catch(() => ({}));
    const aviso_id = String(body.aviso_id ?? "");
    if (!aviso_id) throw new HTTPException(400, { message: "aviso_id obrigatório" });
    await markReadCase(avisoRepository, aviso_id, user.id);
    return c.json({ ok: true });
  });

  router.get("/", async (c) => {
    getAuth(c); // qualquer autenticado
    const rows = (await listAvisosCase(avisoRepository)) as unknown[];
    return c.json({ rows, total: rows.length });
  });

  router.post("/", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = AvisoCreateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    const data = await createAvisoCase(avisoRepository, parsed.data, user.id);
    return c.json(data, 201);
  });

  router.patch("/:id", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = AvisoUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    const data = await updateAvisoCase(avisoRepository, c.req.param("id"), parsed.data, user.role, user.id);
    if (!data) throw new HTTPException(404, { message: "Não encontrado" });
    return c.json(data);
  });

  router.delete("/:id", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    await deleteAvisoCase(avisoRepository, c.req.param("id"), user.role, user.id);
    return c.json({ ok: true });
  });

  return router;
}