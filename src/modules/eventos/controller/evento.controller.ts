import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuth, requireRole } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES } from "../../../infra/shared/roles";
import { EventoCreateSchema, EventoUpdateSchema } from "../dto/evento.dto";
import { eventoRepository } from "../domain/evento.repository";
import {
  createEventoCase,
  deleteEventoCase,
  listEventosCase,
  updateEventoCase,
} from "../cases/evento.cases";

export function eventoController(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    getAuth(c);
    const rows = (await listEventosCase(eventoRepository)) as unknown[];
    return c.json({ rows, total: rows.length });
  });

  router.post("/", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = EventoCreateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    const data = await createEventoCase(eventoRepository, parsed.data, user.id);
    return c.json(data, 201);
  });

  router.patch("/:id", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = EventoUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    const data = await updateEventoCase(eventoRepository, c.req.param("id"), parsed.data);
    if (!data) throw new HTTPException(404, { message: "Não encontrado" });
    return c.json(data);
  });

  router.delete("/:id", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    await deleteEventoCase(eventoRepository, c.req.param("id"));
    return c.json({ ok: true });
  });

  return router;
}