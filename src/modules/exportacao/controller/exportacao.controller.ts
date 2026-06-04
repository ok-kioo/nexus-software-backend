import { Hono } from "hono";
import { requireRole } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES } from "../../../infra/shared/roles";
import { createAdminClient } from "../../../infra/database/supabase-client";
import { dbError } from "../../../infra/shared/db-errors";

export function exportacaoController(): Hono {
  const router = new Hono();

  router.get("/matriculas", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("matriculas")
      .select(
        `numero_matricula, status, data_inicio, data_fim,
        aluno:alunos(nome_aluno, documento),
        turma:turmas(nome_turma,
          curso:cursos(nome_curso),
          unidade:unidades(nome_unidade, estado))`,
      )
      .order("created_at", { ascending: false });
    if (error) throw dbError(error);
    return c.json({ rows: data ?? [] });
  });

  router.get("/turmas", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("turmas")
      .select(
        `nome_turma, capacidade, periodo, turno, status,
        curso:cursos(nome_curso),
        unidade:unidades(nome_unidade, estado),
        matriculas(id, status)`,
      )
      .order("nome_turma");
    if (error) throw dbError(error);
    return c.json({ rows: data ?? [] });
  });

  router.get("/academico", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notas")
      .select(
        `nota_1, nota_2, nota_3, nota_4,
        matricula:matriculas(numero_matricula,
          aluno:alunos(nome_aluno),
          turma:turmas(nome_turma, curso:cursos(nome_curso)))`,
      );
    if (error) throw dbError(error);
    return c.json({ rows: data ?? [] });
  });

  router.get("/permanencia", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("frequencia")
      .select(
        `presente,
        matricula:matriculas(numero_matricula, status,
          aluno:alunos(nome_aluno),
          turma:turmas(nome_turma, unidade:unidades(nome_unidade, estado)))`,
      );
    if (error) throw dbError(error);
    return c.json({ rows: data ?? [] });
  });

  return router;
}