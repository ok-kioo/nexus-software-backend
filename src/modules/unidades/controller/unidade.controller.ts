import { Hono } from "hono";
import { createCrudRouter } from "../../../infra/shared/crud-factory";
import { ADMIN_GESTOR_ROLES, ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { UnidadeCreateSchema, UnidadeUpdateSchema } from "../dto/unidade.dto";

export function unidadeController(): Hono {
  return createCrudRouter({
    table: "unidades",
    searchColumns: ["nome_unidade", "cidade", "estado"],
    defaultOrder: { column: "nome_unidade", ascending: true },
    filterColumns: ["status"],
    createSchema: UnidadeCreateSchema,
    updateSchema: UnidadeUpdateSchema,
    readRoles: READ_ALL_ROLES,
    writeRoles: ADMIN_GESTOR_ROLES,
    deleteRoles: ADMIN_ONLY,
  });
}