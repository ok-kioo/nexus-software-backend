import { Hono } from "hono";
import { getAuth, requireRole, userClient } from "../../../infra/http/auth-middleware";
import { READ_ALL_ROLES } from "../../../infra/shared/roles";
import { dbError } from "../../../infra/shared/db-errors";

const CHUNK = 1000;

async function fetchAll<T>(builder: () => any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder().range(from, from + CHUNK - 1);
    if (error) throw dbError(error);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

export function analyticsController(): Hono {
  const router = new Hono();

  router.get("/base", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    // user-scoped → RLS limita o que professores podem ler
    const client = userClient(c);
    const [matriculas, freq, notas] = await Promise.all([
      fetchAll(() =>
        client.from("matriculas").select(
          `id, status, data_inicio, data_fim,
           aluno:alunos(id, nome_aluno, documento),
           turma:turmas(id, nome_turma, capacidade, periodo, status,
             curso:cursos(id, nome_curso),
             unidade:unidades(id, nome_unidade, estado, cidade))`,
        ),
      ),
      fetchAll(() => client.from("frequencia").select("presente, data, matricula_id")),
      fetchAll(() => client.from("notas").select("matricula_id, nota_1, nota_2, nota_3, nota_4")),
    ]);
    return c.json({ matriculas, freq, notas });
  });

  router.get("/aluno/:id", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const alunoId = c.req.param("id");
    const client = userClient(c);
    const [alunoRes, matriculasRes, freqRes, notasRes, contatosRes] = await Promise.all([
      client.from("alunos").select("*").eq("id", alunoId).maybeSingle(),
      client
        .from("matriculas")
        .select("*, turma:turmas(id, nome_turma, curso:cursos(nome_curso), unidade:unidades(nome_unidade))")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false }),
      client.from("frequencia").select("id, data, presente, matricula_id").order("data", { ascending: false }).limit(500),
      client.from("notas").select("*"),
      client.from("contatos_aluno").select("*").eq("aluno_id", alunoId).order("created_at", { ascending: false }),
    ]);
    if (alunoRes.error) throw dbError(alunoRes.error);
    const matIds = (matriculasRes.data ?? []).map((m: { id: string }) => m.id);
    const freqs = (freqRes.data ?? []).filter((f: { matricula_id: string }) => matIds.includes(f.matricula_id));
    const minhasNotas = (notasRes.data ?? []).filter((n: { matricula_id: string }) => matIds.includes(n.matricula_id));
    return c.json({
      aluno: alunoRes.data,
      matriculas: matriculasRes.data ?? [],
      frequencias: freqs,
      notas: minhasNotas,
      contatos: contatosRes.data ?? [],
    });
  });

  router.get("/turma/:id", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const turmaId = c.req.param("id");
    const client = userClient(c);
    const { data: turma, error: tErr } = await client
      .from("turmas")
      .select("*, curso:cursos(nome_curso), unidade:unidades(nome_unidade, cidade, estado)")
      .eq("id", turmaId)
      .maybeSingle();
    if (tErr) throw dbError(tErr);

    const { data: matriculas, error: mErr } = await client
      .from("matriculas")
      .select("*, aluno:alunos(id, nome_aluno, documento)")
      .eq("turma_id", turmaId);
    if (mErr) throw dbError(mErr);

    const matIds = (matriculas ?? []).map((m: { id: string }) => m.id);
    let freq: unknown[] = [];
    let notas: unknown[] = [];
    if (matIds.length) {
      const [fRes, nRes] = await Promise.all([
        client.from("frequencia").select("*").in("matricula_id", matIds),
        client.from("notas").select("*").in("matricula_id", matIds),
      ]);
      if (fRes.error) throw dbError(fRes.error);
      if (nRes.error) throw dbError(nRes.error);
      freq = fRes.data ?? [];
      notas = nRes.data ?? [];
    }

    const { data: profs } = await client.from("turma_professores").select("professor_id").eq("turma_id", turmaId);
    let professores: unknown[] = [];
    if (profs && profs.length > 0) {
      const ids = profs.map((p: { professor_id: string }) => p.professor_id);
      const { data: profiles } = await client.from("profiles").select("id, name, email").in("id", ids);
      professores = profiles ?? [];
    }
    return c.json({ turma, matriculas: matriculas ?? [], frequencias: freq, notas, professores });
  });

  router.get("/turmas-do-professor", async (c) => {
    const { user } = getAuth(c);
    // Mantemos a query escopada explicitamente ao próprio user.id; user-scoped client
    // garantiria o mesmo via RLS, mas aqui o filtro já está correto.
    const client = userClient(c);
    const { data, error } = await client
      .from("turma_professores")
      .select(
        `turma:turmas(id, nome_turma, capacidade, periodo, status,
           curso:cursos(nome_curso),
           unidade:unidades(nome_unidade, estado))`,
      )
      .eq("professor_id", user.id);
    if (error) throw dbError(error);
    const turmas = (data ?? []).map((r: { turma: unknown }) => r.turma).filter(Boolean);
    return c.json({ rows: turmas });
  });

  router.get("/matriculas-da-turma/:turmaId", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const turmaId = c.req.param("turmaId");
    const client = userClient(c);
    const { data, error } = await client
      .from("matriculas")
      .select("id, status, aluno:alunos(id, nome_aluno)")
      .eq("turma_id", turmaId)
      .eq("status", "ativa")
      .order("created_at");
    if (error) throw dbError(error);
    return c.json({ rows: data ?? [] });
  });

  // Conta alunos ativos por turma. Usa querystring ?turmaIds=uuid1,uuid2,...
  router.get("/turmas-counts", async (c) => {
    requireRole(c, READ_ALL_ROLES);
    const raw = c.req.query("turmaIds") ?? "";
    const turmaIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (turmaIds.length === 0) return c.json({ counts: {} });
    const client = userClient(c);
    const { data, error } = await client
      .from("matriculas")
      .select("turma_id, status")
      .eq("status", "ativa")
      .in("turma_id", turmaIds);
    if (error) throw dbError(error);
    const counts: Record<string, number> = {};
    for (const m of data ?? []) {
      const tid = (m as { turma_id: string }).turma_id;
      counts[tid] = (counts[tid] ?? 0) + 1;
    }
    return c.json({ counts });
  });

  return router;
}