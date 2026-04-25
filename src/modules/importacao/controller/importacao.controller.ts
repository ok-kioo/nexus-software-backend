import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAdminClient } from "../../../infra/database/supabase-client";
import { requireRole, getAuth } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES } from "../../../infra/shared/roles";
import {
  ImportPreviewBody,
  ImportCommitBody,
  COMMIT_ORDER,
  type EntityResult,
  type ImportEntityKey,
  norm,
  numOrNull,
  boolFromCell,
  dateOrNull,
} from "../../../infra/shared/import-validators";
import { ImportJobRepository } from "../domain/import-job.repository";
import { enqueueJob } from "../worker/job-processor";
import { ImportJobIdParam, ListImportJobsQuery } from "../dto/import-job.dto";
import { parseQuery, parseUuidParam } from "../../../infra/http/validation";

type Row = Record<string, unknown>;

interface Lookups {
  unidades?: Map<string, string>;
  cursos?: Map<string, string>;
  turmas?: Map<string, string>;
  alunosByDoc?: Map<string, string>;
  alunosByName?: Map<string, string>;
  matsByAlTurma?: Map<string, string>;
}

async function buildLookups(
  admin: ReturnType<typeof createAdminClient>,
  need: (keyof Lookups)[],
): Promise<Lookups> {
  const lk: Lookups = {};
  if (need.includes("unidades")) {
    const { data } = await admin.from("unidades").select("id, nome_unidade");
    lk.unidades = new Map((data ?? []).map((u) => [u.nome_unidade.toLowerCase(), u.id]));
  }
  if (need.includes("cursos")) {
    const { data } = await admin.from("cursos").select("id, nome_curso");
    lk.cursos = new Map((data ?? []).map((c) => [c.nome_curso.toLowerCase(), c.id]));
  }
  if (need.includes("turmas")) {
    const { data } = await admin.from("turmas").select("id, nome_turma");
    lk.turmas = new Map((data ?? []).map((t) => [t.nome_turma.toLowerCase(), t.id]));
  }
  if (need.includes("alunosByDoc") || need.includes("alunosByName")) {
    const { data } = await admin.from("alunos").select("id, nome_aluno, documento");
    lk.alunosByDoc = new Map((data ?? []).map((a) => [String(a.documento), a.id]));
    lk.alunosByName = new Map((data ?? []).map((a) => [a.nome_aluno.toLowerCase(), a.id]));
  }
  if (need.includes("matsByAlTurma")) {
    const { data } = await admin.from("matriculas").select("id, aluno_id, turma_id");
    lk.matsByAlTurma = new Map((data ?? []).map((m) => [`${m.aluno_id}|${m.turma_id}`, m.id]));
  }
  return lk;
}

async function processEntity(
  entity: ImportEntityKey,
  rows: Row[],
  admin: ReturnType<typeof createAdminClient>,
): Promise<EntityResult> {
  const errors: string[] = [];
  let inserted = 0;

  if (entity === "unidades") {
    const payload = rows
      .map((r) => ({
        nome_unidade: norm(r.nome_unidade),
        cidade: norm(r.cidade),
        estado: norm(r.estado),
        status: norm(r.status) ?? "ativa",
      }))
      .filter((r) => r.nome_unidade && r.cidade && r.estado);
    if (payload.length) {
      const { error, count } = await admin.from("unidades").insert(payload as never[], { count: "exact" });
      if (error) errors.push(error.message);
      else inserted = count ?? payload.length;
    }
    return { entity, inserted, skipped: rows.length - inserted, errors };
  }

  if (entity === "cursos") {
    const payload = rows
      .map((r) => ({
        nome_curso: norm(r.nome_curso),
        categoria: norm(r.categoria),
        carga_horaria: numOrNull(r.carga_horaria),
        status: norm(r.status) ?? "ativo",
      }))
      .filter((r) => r.nome_curso && r.categoria);
    if (payload.length) {
      const { error, count } = await admin.from("cursos").insert(payload as never[], { count: "exact" });
      if (error) errors.push(error.message);
      else inserted = count ?? payload.length;
    }
    return { entity, inserted, skipped: rows.length - inserted, errors };
  }

  if (entity === "turmas") {
    const lk = await buildLookups(admin, ["unidades", "cursos"]);
    const payload: Row[] = [];
    rows.forEach((r, i) => {
      const uid = lk.unidades!.get(String(r.nome_unidade ?? "").toLowerCase());
      const cid = lk.cursos!.get(String(r.nome_curso ?? "").toLowerCase());
      if (!uid || !cid) {
        errors.push(`Linha ${i + 2}: unidade/curso não encontrado`);
        return;
      }
      payload.push({
        nome_turma: norm(r.nome_turma),
        unidade_id: uid,
        curso_id: cid,
        capacidade: numOrNull(r.capacidade) ?? 40,
        periodo: norm(r.periodo),
        turno: norm(r.turno),
        status: norm(r.status) ?? "ativa",
      });
    });
    if (payload.length) {
      const { error, count } = await admin.from("turmas").insert(payload as never[], { count: "exact" });
      if (error) errors.push(error.message);
      else inserted = count ?? payload.length;
    }
    return { entity, inserted, skipped: rows.length - inserted, errors };
  }

  if (entity === "alunos") {
    const payload = rows
      .map((r) => ({
        nome_aluno: norm(r.nome_aluno),
        documento: norm(r.documento),
        data_nascimento: dateOrNull(r.data_nascimento),
        email: norm(r.email),
        telefone: norm(r.telefone),
        status: norm(r.status) ?? "ativo",
      }))
      .filter((r) => r.nome_aluno && r.documento);
    if (payload.length) {
      const { error, count } = await admin.from("alunos").insert(payload as never[], { count: "exact" });
      if (error) errors.push(error.message);
      else inserted = count ?? payload.length;
    }
    return { entity, inserted, skipped: rows.length - inserted, errors };
  }

  if (entity === "matriculas") {
    const lk = await buildLookups(admin, ["alunosByDoc", "alunosByName", "turmas"]);
    const payload: Row[] = [];
    rows.forEach((r, i) => {
      const aid =
        lk.alunosByDoc!.get(String(r.documento ?? "")) ||
        lk.alunosByName!.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas!.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) {
        errors.push(`Linha ${i + 2}: aluno/turma não encontrado`);
        return;
      }
      payload.push({
        aluno_id: aid,
        turma_id: tid,
        numero_matricula: norm(r.numero_matricula),
        status: norm(r.status) ?? "ativa",
        data_inicio: dateOrNull(r.data_inicio),
        data_fim: dateOrNull(r.data_fim),
      });
    });
    if (payload.length) {
      const { error, count } = await admin.from("matriculas").insert(payload as never[], { count: "exact" });
      if (error) errors.push(error.message);
      else inserted = count ?? payload.length;
    }
    return { entity, inserted, skipped: rows.length - inserted, errors };
  }

  if (entity === "frequencia") {
    const lk = await buildLookups(admin, ["alunosByDoc", "alunosByName", "turmas", "matsByAlTurma"]);
    const payload: Row[] = [];
    rows.forEach((r, i) => {
      const aid =
        lk.alunosByDoc!.get(String(r.documento ?? "")) ||
        lk.alunosByName!.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas!.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) {
        errors.push(`Linha ${i + 2}: aluno/turma não encontrado`);
        return;
      }
      const mid = lk.matsByAlTurma!.get(`${aid}|${tid}`);
      if (!mid) {
        errors.push(`Linha ${i + 2}: matrícula não encontrada para o aluno/turma`);
        return;
      }
      const data = dateOrNull(r.data);
      if (!data) {
        errors.push(`Linha ${i + 2}: data inválida`);
        return;
      }
      payload.push({
        matricula_id: mid,
        data,
        presente: boolFromCell(r.presente),
        observacao: norm(r.observacao),
      });
    });
    if (payload.length) {
      const { error, count } = await admin.from("frequencia").insert(payload as never[], { count: "exact" });
      if (error) errors.push(error.message);
      else inserted = count ?? payload.length;
    }
    return { entity, inserted, skipped: rows.length - inserted, errors };
  }

  if (entity === "notas") {
    const lk = await buildLookups(admin, ["alunosByDoc", "alunosByName", "turmas", "matsByAlTurma"]);
    const payload: Row[] = [];
    rows.forEach((r, i) => {
      const aid =
        lk.alunosByDoc!.get(String(r.documento ?? "")) ||
        lk.alunosByName!.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas!.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) {
        errors.push(`Linha ${i + 2}: aluno/turma não encontrado`);
        return;
      }
      const mid = lk.matsByAlTurma!.get(`${aid}|${tid}`);
      if (!mid) {
        errors.push(`Linha ${i + 2}: matrícula não encontrada`);
        return;
      }
      payload.push({
        matricula_id: mid,
        nota_1: numOrNull(r.nota_1),
        nota_2: numOrNull(r.nota_2),
        nota_3: numOrNull(r.nota_3),
        nota_4: numOrNull(r.nota_4),
        observacao: norm(r.observacao),
      });
    });
    if (payload.length) {
      const { error, count } = await admin
        .from("notas")
        .upsert(payload as never[], { onConflict: "matricula_id", count: "exact" });
      if (error) errors.push(error.message);
      else inserted = count ?? payload.length;
    }
    return { entity, inserted, skipped: rows.length - inserted, errors };
  }

  return { entity, inserted: 0, skipped: rows.length, errors: ["entidade desconhecida"] };
}


function validateRow(entity: ImportEntityKey, r: Row, lk: Lookups): string | null {
  switch (entity) {
    case "unidades":
      if (!norm(r.nome_unidade) || !norm(r.cidade) || !norm(r.estado)) return "campos obrigatórios ausentes";
      return null;
    case "cursos":
      if (!norm(r.nome_curso) || !norm(r.categoria)) return "campos obrigatórios ausentes";
      return null;
    case "turmas":
      if (!norm(r.nome_turma)) return "nome_turma ausente";
      if (!lk.unidades?.get(String(r.nome_unidade ?? "").toLowerCase())) return "unidade não encontrada";
      if (!lk.cursos?.get(String(r.nome_curso ?? "").toLowerCase())) return "curso não encontrado";
      return null;
    case "alunos":
      if (!norm(r.nome_aluno) || !norm(r.documento)) return "campos obrigatórios ausentes";
      return null;
    case "matriculas": {
      const aid =
        lk.alunosByDoc?.get(String(r.documento ?? "")) ||
        lk.alunosByName?.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas?.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) return "aluno/turma não encontrado";
      if (!norm(r.numero_matricula)) return "numero_matricula ausente";
      return null;
    }
    case "frequencia":
    case "notas": {
      const aid =
        lk.alunosByDoc?.get(String(r.documento ?? "")) ||
        lk.alunosByName?.get(String(r.nome_aluno ?? "").toLowerCase());
      const tid = lk.turmas?.get(String(r.nome_turma ?? "").toLowerCase());
      if (!aid || !tid) return "aluno/turma não encontrado";
      if (!lk.matsByAlTurma?.get(`${aid}|${tid}`)) return "matrícula não encontrada";
      if (entity === "frequencia" && !dateOrNull(r.data)) return "data inválida";
      return null;
    }
    default:
      return "entidade desconhecida";
  }
}

export function importacaoController(): Hono {
  const router = new Hono();

  // ───── Novos endpoints assíncronos (jobs) ─────────────────────────

  router.post("/jobs", async (c) => {
    const user = requireRole(c, ADMIN_GESTOR_ROLES);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "Arquivo .xlsx ausente (campo 'file' do formulário)" });
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx") {
      throw new HTTPException(400, { message: "Formato inválido. Envie apenas planilhas .xlsx." });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      throw new HTTPException(400, { message: "Arquivo não é um .xlsx válido (assinatura inválida)." });
    }

    const admin = createAdminClient();
    const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await admin.storage
      .from("import-uploads")
      .upload(storagePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false,
      });
    if (upErr) throw new HTTPException(500, { message: `Falha ao salvar arquivo: ${upErr.message}` });

    const repo = new ImportJobRepository(admin);
    const job = await repo.create({
      user_id: user.id,
      file_name: file.name,
      file_size_bytes: buffer.length,
      storage_path: storagePath,
    });

    enqueueJob(job.id);
    return c.json({ job_id: job.id, status: job.status }, 202);
  });

  router.get("/jobs", async (c) => {
    const { user } = getAuth(c);
    const isAdmin = user.role === "administrador";
    const query = parseQuery(c, ListImportJobsQuery);
    const repo = new ImportJobRepository();
    const result = await repo.listByUser(user.id, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      isAdmin,
    });
    return c.json(result);
  });

  router.get("/jobs/:id", async (c) => {
    const { user } = getAuth(c);
    const id = parseUuidParam(c, "id");
    const repo = new ImportJobRepository();
    const job = await repo.findById(id);
    if (!job) throw new HTTPException(404, { message: "Job não encontrado" });
    if (job.user_id !== user.id && user.role !== "administrador") {
      throw new HTTPException(403, { message: "Sem permissão" });
    }
    return c.json(job);
  });

  router.delete("/jobs/:id", async (c) => {
    const { user } = getAuth(c);
    const id = parseUuidParam(c, "id");
    const repo = new ImportJobRepository();
    const job = await repo.findById(id);
    if (!job) throw new HTTPException(404, { message: "Job não encontrado" });
    if (job.user_id !== user.id && user.role !== "administrador") {
      throw new HTTPException(403, { message: "Sem permissão" });
    }
    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return c.json({ ok: true, status: job.status });
    }
    await repo.markCancelled(id);
    return c.json({ ok: true, status: "cancelled" });
  });

  // ───── Endpoints legados (mantidos para compatibilidade) ──────────

  router.post("/preview", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = ImportPreviewBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const { entity, rows } = parsed.data;
    const admin = createAdminClient();
    const need: (keyof Lookups)[] =
      entity === "turmas"
        ? ["unidades", "cursos"]
        : entity === "matriculas"
        ? ["alunosByDoc", "alunosByName", "turmas"]
        : entity === "frequencia" || entity === "notas"
        ? ["alunosByDoc", "alunosByName", "turmas", "matsByAlTurma"]
        : [];
    const lk = await buildLookups(admin, need);
    const valid: number[] = [];
    const invalid: { row: number; reason: string }[] = [];
    rows.forEach((r, i) => {
      const reason = validateRow(entity, r, lk);
      if (reason) invalid.push({ row: i + 2, reason });
      else valid.push(i + 2);
    });
    return c.json({ entity, total: rows.length, valid: valid.length, invalid });
  });

  router.post("/commit", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = ImportCommitBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const admin = createAdminClient();
    const byEntity = new Map<ImportEntityKey, Row[]>();
    for (const b of parsed.data.batches) byEntity.set(b.entity, b.rows);
    const results: EntityResult[] = [];
    for (const ent of COMMIT_ORDER) {
      const rows = byEntity.get(ent);
      if (!rows) continue;
      results.push(await processEntity(ent, rows, admin));
    }
    return c.json({ results });
  });

  return router;
}
