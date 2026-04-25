import { createAdminClient } from "../../../infra/database/supabase-client";
import { runWithConcurrency, chunk } from "../../../infra/shared/parallel";
import {
  COMMIT_ORDER,
  norm,
  numOrNull,
  boolFromCell,
  dateOrNull,
  type ImportEntityKey,
} from "../../../infra/shared/import-validators";
import type { EntitySummary } from "../domain/import-job.entity";
import type { ValidatedEntity } from "./validate-workbook.case";

type Row = Record<string, unknown>;
type Admin = ReturnType<typeof createAdminClient>;

const CHUNK_SIZE = 1000;
const PARALLEL_INSERTS = 4;

interface Lookups {
  unidades?: Map<string, string>;
  cursos?: Map<string, string>;
  turmas?: Map<string, string>;
  alunosByDoc?: Map<string, string>;
  alunosByName?: Map<string, string>;
  matsByAlTurma?: Map<string, string>;
}

async function buildLookups(admin: Admin, need: (keyof Lookups)[]): Promise<Lookups> {
  const lk: Lookups = {};
  const tasks: Promise<void>[] = [];
  if (need.includes("unidades")) {
    tasks.push((async () => {
      const { data } = await admin.from("unidades").select("id, nome_unidade");
      lk.unidades = new Map((data ?? []).map((u) => [String(u.nome_unidade).toLowerCase(), u.id]));
    })());
  }
  if (need.includes("cursos")) {
    tasks.push((async () => {
      const { data } = await admin.from("cursos").select("id, nome_curso");
      lk.cursos = new Map((data ?? []).map((c) => [String(c.nome_curso).toLowerCase(), c.id]));
    })());
  }
  if (need.includes("turmas")) {
    tasks.push((async () => {
      const { data } = await admin.from("turmas").select("id, nome_turma");
      lk.turmas = new Map((data ?? []).map((t) => [String(t.nome_turma).toLowerCase(), t.id]));
    })());
  }
  if (need.includes("alunosByDoc") || need.includes("alunosByName")) {
    tasks.push((async () => {
      const { data } = await admin.from("alunos").select("id, nome_aluno, documento");
      lk.alunosByDoc = new Map((data ?? []).map((a) => [String(a.documento), a.id]));
      lk.alunosByName = new Map((data ?? []).map((a) => [String(a.nome_aluno).toLowerCase(), a.id]));
    })());
  }
  if (need.includes("matsByAlTurma")) {
    tasks.push((async () => {
      const { data } = await admin.from("matriculas").select("id, aluno_id, turma_id");
      lk.matsByAlTurma = new Map((data ?? []).map((m) => [`${m.aluno_id}|${m.turma_id}`, m.id]));
    })());
  }
  await Promise.all(tasks);
  return lk;
}

function buildPayload(entity: ImportEntityKey, rows: Row[], lk: Lookups): { payload: Row[]; skipped: number; errors: string[] } {
  const out: Row[] = [];
  const errors: string[] = [];
  let skipped = 0;

  rows.forEach((r, i) => {
    const lineNo = i + 2;
    if (entity === "unidades") {
      out.push({
        nome_unidade: norm(r.nome_unidade),
        cidade: norm(r.cidade),
        estado: norm(r.estado),
        status: norm(r.status) ?? "ativa",
      });
    } else if (entity === "cursos") {
      out.push({
        nome_curso: norm(r.nome_curso),
        categoria: norm(r.categoria),
        carga_horaria: numOrNull(r.carga_horaria),
        status: norm(r.status) ?? "ativo",
      });
    } else if (entity === "turmas") {
      const uid = lk.unidades?.get(String(r.nome_unidade ?? "").toLowerCase());
      const cid = lk.cursos?.get(String(r.nome_curso ?? "").toLowerCase());
      if (!uid || !cid) { errors.push(`Linha ${lineNo}: unidade/curso não encontrado`); skipped++; return; }
      out.push({
        nome_turma: norm(r.nome_turma),
        unidade_id: uid,
        curso_id: cid,
        capacidade: numOrNull(r.capacidade) ?? 40,
        periodo: norm(r.periodo),
        turno: norm(r.turno),
        status: norm(r.status) ?? "ativa",
      });
    } else if (entity === "alunos") {
      out.push({
        nome_aluno: norm(r.nome_aluno),
        documento: norm(r.documento),
        data_nascimento: dateOrNull(r.data_nascimento),
        email: norm(r.email),
        telefone: norm(r.telefone),
        status: norm(r.status) ?? "ativo",
      });
    } else if (entity === "matriculas") {
      const aid = lk.alunosByDoc?.get(String(r.documento ?? "")) ||
                  lk.alunosByName?.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas?.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) { errors.push(`Linha ${lineNo}: aluno/turma não encontrado`); skipped++; return; }
      out.push({
        aluno_id: aid,
        turma_id: tid,
        numero_matricula: norm(r.numero_matricula),
        status: norm(r.status) ?? "ativa",
        data_inicio: dateOrNull(r.data_inicio),
        data_fim: dateOrNull(r.data_fim),
      });
    } else if (entity === "frequencia") {
      const aid = lk.alunosByDoc?.get(String(r.documento ?? "")) ||
                  lk.alunosByName?.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas?.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) { errors.push(`Linha ${lineNo}: aluno/turma não encontrado`); skipped++; return; }
      const mid = lk.matsByAlTurma?.get(`${aid}|${tid}`);
      if (!mid) { errors.push(`Linha ${lineNo}: matrícula não encontrada`); skipped++; return; }
      const data = dateOrNull(r.data);
      if (!data) { errors.push(`Linha ${lineNo}: data inválida`); skipped++; return; }
      out.push({
        matricula_id: mid,
        data,
        presente: boolFromCell(r.presente),
        observacao: norm(r.observacao),
      });
    } else if (entity === "notas") {
      const aid = lk.alunosByDoc?.get(String(r.documento ?? "")) ||
                  lk.alunosByName?.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas?.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) { errors.push(`Linha ${lineNo}: aluno/turma não encontrado`); skipped++; return; }
      const mid = lk.matsByAlTurma?.get(`${aid}|${tid}`);
      if (!mid) { errors.push(`Linha ${lineNo}: matrícula não encontrada`); skipped++; return; }
      out.push({
        matricula_id: mid,
        nota_1: numOrNull(r.nota_1),
        nota_2: numOrNull(r.nota_2),
        nota_3: numOrNull(r.nota_3),
        nota_4: numOrNull(r.nota_4),
        observacao: norm(r.observacao),
      });
    }
  });

  return { payload: out, skipped, errors };
}

const TABLE_BY_ENTITY: Record<ImportEntityKey, string> = {
  unidades: "unidades", cursos: "cursos", turmas: "turmas", alunos: "alunos",
  matriculas: "matriculas", frequencia: "frequencia", notas: "notas",
};

const NEED_BY_ENTITY: Record<ImportEntityKey, (keyof Lookups)[]> = {
  unidades: [],
  cursos: [],
  turmas: ["unidades", "cursos"],
  alunos: [],
  matriculas: ["alunosByDoc", "alunosByName", "turmas"],
  frequencia: ["alunosByDoc", "alunosByName", "turmas", "matsByAlTurma"],
  notas: ["alunosByDoc", "alunosByName", "turmas", "matsByAlTurma"],
};

/**
 * Persiste cada entidade em ordem referencial (sequencial entre entidades).
 * Dentro de cada entidade, faz inserts em paralelo limitados por semáforo.
 */
export async function persistWorkbook(
  entities: ValidatedEntity[],
  opts: {
    onProgress?: (done: number, total: number, entityName: string) => void;
    isCancelled?: () => Promise<boolean>;
  } = {},
): Promise<EntitySummary[]> {
  const admin = createAdminClient();
  const summaries: EntitySummary[] = [];
  const byEntity = new Map(entities.map((e) => [e.entity, e]));

  // Total global de chunks para barra de progresso
  const totalChunks =
    entities.reduce((a, e) => a + Math.ceil(e.rows.length / CHUNK_SIZE), 0) || 1;
  let chunksDone = 0;

  for (const ent of COMMIT_ORDER) {
    const item = byEntity.get(ent);
    if (!item || item.rows.length === 0) continue;

    if (await opts.isCancelled?.()) throw new Error("Importação cancelada");

    // Atualiza lookups APÓS as entidades dependentes terem sido inseridas
    const need = NEED_BY_ENTITY[ent];
    const lk = need.length ? await buildLookups(admin, need) : {};

    const { payload, skipped, errors } = buildPayload(ent, item.rows, lk);
    let inserted = 0;

    if (payload.length > 0) {
      const chunks = chunk(payload, CHUNK_SIZE);
      await runWithConcurrency(
        chunks,
        PARALLEL_INSERTS,
        async (rows) => {
          if (await opts.isCancelled?.()) throw new Error("Importação cancelada");
          let resp;
          if (ent === "notas") {
            resp = await admin.from(TABLE_BY_ENTITY[ent])
              .upsert(rows as never[], { onConflict: "matricula_id", count: "exact" });
          } else {
            resp = await admin.from(TABLE_BY_ENTITY[ent])
              .insert(rows as never[], { count: "exact" });
          }
          if (resp.error) errors.push(resp.error.message);
          else inserted += resp.count ?? rows.length;
          chunksDone++;
          opts.onProgress?.(chunksDone, totalChunks, ent);
        },
      );
    }

    summaries.push({ entity: ent, inserted, skipped, errors });
  }

  return summaries;
}