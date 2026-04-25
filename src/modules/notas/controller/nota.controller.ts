import { Hono } from "hono";
import { createCrudRouter } from "../../../infra/shared/crud-factory";
import { requireRole, userClient } from "../../../infra/http/auth-middleware";
import { ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { NotaCreateSchema, NotaUpdateSchema } from "../dto/nota.dto";
import { notaRepository } from "../domain/nota.repository";
import { listNotasByTurmaCase } from "../cases/list-notas-by-turma.case";

export function notaController(): Hono {
  const router = new Hono();

  router.get("/by-turma/:turmaId", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    // Cliente user-scoped: RLS garante que professores só vejam suas turmas.
    const result = await listNotasByTurmaCase(notaRepository, userClient(c), c.req.param("turmaId"));
    return c.json(result);
  });

  router.route(
    "/",
    createCrudRouter({
      table: "notas",
      defaultOrder: { column: "updated_at", ascending: false },
      filterColumns: ["matricula_id"],
      createSchema: NotaCreateSchema,
      updateSchema: NotaUpdateSchema,
      readRoles: READ_ALL_ROLES,
      writeRoles: READ_ALL_ROLES,
      deleteRoles: ADMIN_ONLY,
      clientMode: "user",
    }),
  );

  return router;
}