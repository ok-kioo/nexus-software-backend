import { Hono } from "hono";
import { createCrudRouter } from "../../../infra/shared/crud-factory";
import { ADMIN_GESTOR_ROLES, ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { CursoCreateSchema, CursoUpdateSchema } from "../dto/curso.dto";

export function cursoController(): Hono {
  return createCrudRouter({
    table: "cursos",
    searchColumns: ["nome_curso", "categoria"],
    defaultOrder: { column: "nome_curso", ascending: true },
    filterColumns: ["status", "categoria"],
    createSchema: CursoCreateSchema,
    updateSchema: CursoUpdateSchema,
    readRoles: READ_ALL_ROLES,
    writeRoles: ADMIN_GESTOR_ROLES,
    deleteRoles: ADMIN_ONLY,
  });
}