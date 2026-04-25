import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole, userClient } from "../../../infra/http/auth-middleware";
import { READ_ALL_ROLES } from "../../../infra/shared/roles";
import { ContatoCreateSchema } from "../dto/contato.dto";
import { contatoRepository } from "../domain/contato.repository";
import {
  createContatoCase,
  deleteContatoCase,
  listContatosCase,
} from "../cases/contato.cases";

export function contatoController(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const rows = (await listContatosCase(
      contatoRepository,
      userClient(c),
      c.req.query("aluno_id"),
    )) as unknown[];
    return c.json({ rows, total: rows.length });
  });

  router.post("/", async (c) => {
    const user = requireRole(c, READ_ALL_ROLES);
    const parsed = ContatoCreateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    const data = await createContatoCase(contatoRepository, userClient(c), parsed.data, user.id);
    return c.json(data, 201);
  });

  router.delete("/:id", async (c) => {
    const user = requireRole(c, READ_ALL_ROLES);
    await deleteContatoCase(contatoRepository, userClient(c), c.req.param("id"), user.role, user.id);
    return c.json({ ok: true });
  });

  return router;
}