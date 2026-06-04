import { Hono } from "hono";
import { createCrudRouter } from "../../../infra/shared/crud-factory";
import { requireRole, userClient } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES, ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { parsePage, parsePageSize } from "../../../infra/shared/utils";
import { MatriculaCreateSchema, MatriculaUpdateSchema } from "../dto/matricula.dto";
import { matriculaRepository } from "../domain/matricula.repository";
import { listMatriculasWithRelationsCase } from "../cases/list-matriculas-with-relations.case";

export function matriculaController(): Hono {
  const router = new Hono();

  router.get("/with-relations", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const result = await listMatriculasWithRelationsCase(matriculaRepository, userClient(c), {
      page: parsePage(c.req.query("page")),
      pageSize: parsePageSize(c.req.query("pageSize")),
      search: c.req.query("search")?.trim(),
      status: c.req.query("status"),
      dataInicio: c.req.query("dataInicio"),
      dataFim: c.req.query("dataFim"),
      unidadeId: c.req.query("unidadeId"),
      cursoId: c.req.query("cursoId"),
      turmaId: c.req.query("turmaId"),
    });
    return c.json(result);
  });

  router.route(
    "/",
    createCrudRouter({
      table: "matriculas",
      searchColumns: ["numero_matricula"],
      defaultOrder: { column: "created_at", ascending: false },
      filterColumns: ["status", "turma_id", "aluno_id"],
      createSchema: MatriculaCreateSchema,
      updateSchema: MatriculaUpdateSchema,
      readRoles: READ_ALL_ROLES,
      writeRoles: ADMIN_GESTOR_ROLES,
      deleteRoles: ADMIN_ONLY,
      clientMode: "user",
    }),
  );

  return router;
}