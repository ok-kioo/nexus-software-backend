import { Hono } from "hono";
import { createCrudRouter } from "../../../infra/shared/crud-factory";
import { requireRole, userClient } from "../../../infra/http/auth-middleware";
import { ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { FrequenciaCreateSchema, FrequenciaUpdateSchema } from "../dto/frequencia.dto";
import { frequenciaRepository } from "../domain/frequencia.repository";
import { listFrequenciaByTurmaCase } from "../cases/list-frequencia-by-turma.case";

export function frequenciaController(): Hono {
  const router = new Hono();

  router.get("/by-turma/:turmaId", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const result = await listFrequenciaByTurmaCase(
      frequenciaRepository,
      userClient(c),
      c.req.param("turmaId"),
      c.req.query("from"),
      c.req.query("to"),
    );
    return c.json(result);
  });

  router.route(
    "/",
    createCrudRouter({
      table: "frequencia",
      defaultOrder: { column: "data", ascending: false },
      filterColumns: ["matricula_id", "presente"],
      createSchema: FrequenciaCreateSchema,
      updateSchema: FrequenciaUpdateSchema,
      readRoles: READ_ALL_ROLES,
      writeRoles: READ_ALL_ROLES,
      deleteRoles: ADMIN_ONLY,
      clientMode: "user",
    }),
  );

  return router;
}