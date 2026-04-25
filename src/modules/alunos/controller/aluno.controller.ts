import { Hono } from "hono";
import { createCrudRouter } from "../../../infra/shared/crud-factory";
import { ADMIN_GESTOR_ROLES, ADMIN_ONLY, READ_ALL_ROLES } from "../../../infra/shared/roles";
import { AlunoCreateSchema, AlunoUpdateSchema } from "../dto/aluno.dto";

export function alunoController(): Hono {
  return createCrudRouter({
    table: "alunos",
    searchColumns: ["nome_aluno", "documento", "email"],
    defaultOrder: { column: "nome_aluno", ascending: true },
    filterColumns: ["status"],
    createSchema: AlunoCreateSchema,
    updateSchema: AlunoUpdateSchema,
    readRoles: READ_ALL_ROLES,
    writeRoles: ADMIN_GESTOR_ROLES,
    deleteRoles: ADMIN_ONLY,
  });
}