import { Hono } from "hono";
import { createCrudRouter } from "../../../infra/shared/crud-factory";
import { ADMIN_GESTOR_ROLES, ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { requireRole, userClient } from "../../../infra/http/auth-middleware";
import { TurmaCreateSchema, TurmaUpdateSchema } from "../dto/turma.dto";
import { turmaRepository } from "../domain/turma.repository";
import { listTurmasWithRelationsCase } from "../cases/list-turmas-with-relations.case";

export function turmaController(): Hono {
  const router = new Hono();

  router.get("/with-relations", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const rows = await listTurmasWithRelationsCase(turmaRepository, userClient(c));
    return c.json({ rows });
  });

  router.route(
    "/",
    createCrudRouter({
      table: "turmas",
      searchColumns: ["nome_turma"],
      defaultOrder: { column: "nome_turma", ascending: true },
      filterColumns: ["status", "unidade_id", "curso_id"],
      createSchema: TurmaCreateSchema,
      updateSchema: TurmaUpdateSchema,
      readRoles: READ_ALL_ROLES,
      writeRoles: ADMIN_GESTOR_ROLES,
      deleteRoles: ADMIN_ONLY,
      clientMode: "user",
    }),
  );

  return router;
}