import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../../infra/shared/db-errors";
import type { AlertaSnapshot } from "../domain/alerta.entity";

interface RawMatricula {
  id: string;
  status: string;
  aluno: { id: string; nome_aluno: string } | null;
  turma: {
    id: string;
    nome_turma: string;
    capacidade: number;
    unidade: { id: string; nome_unidade: string; estado: string } | null;
  } | null;
}
interface RawFreq { presente: boolean; data: string; matricula_id: string }
interface RawNota {
  matricula_id: string;
  nota_1: number | null;
  nota_2: number | null;
  nota_3: number | null;
  nota_4: number | null;
}

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

function computeAvg(notas: RawNota[]) {
  const byMat = new Map<string, number>();
  notas.forEach((n) => {
    const arr = [n.nota_1, n.nota_2, n.nota_3, n.nota_4].filter(
      (v): v is number => v !== null && v !== undefined,
    );
    if (arr.length) byMat.set(n.matricula_id, arr.reduce((a, b) => a + Number(b), 0) / arr.length);
  });
  return byMat;
}

function computePresence(freq: RawFreq[]) {
  const sorted = [...freq].sort((a, b) => b.data.localeCompare(a.data));
  const totalMap = new Map<string, { total: number; pres: number }>();
  const consec = new Map<string, number>();
  const grouped = new Map<string, RawFreq[]>();
  sorted.forEach((f) => {
    const cur = totalMap.get(f.matricula_id) ?? { total: 0, pres: 0 };
    cur.total += 1;
    if (f.presente) cur.pres += 1;
    totalMap.set(f.matricula_id, cur);
    const arr = grouped.get(f.matricula_id) ?? [];
    arr.push(f);
    grouped.set(f.matricula_id, arr);
  });
  grouped.forEach((arr, id) => {
    let absents = 0;
    for (const f of arr) {
      if (f.presente) break;
      absents += 1;
    }
    consec.set(id, absents);
  });
  return { totalMap, consec };
}

/**
 * Recomputa todos os alertas a partir do estado atual do banco.
 * Não persiste nada — retorna snapshots para o caso de uso `snapshot-alertas` aplicar.
 * Usa o `client` (admin ou user-scoped) recebido para respeitar o escopo de leitura.
 */
export async function computeAlertasCase(client: SupabaseClient): Promise<AlertaSnapshot[]> {
  const [matriculas, freq, notas] = await Promise.all([
    fetchAll<RawMatricula>(() =>
      client.from("matriculas").select(
        `id, status,
         aluno:alunos(id, nome_aluno),
         turma:turmas(id, nome_turma, capacidade,
           unidade:unidades(id, nome_unidade, estado))`,
      ),
    ),
    fetchAll<RawFreq>(() => client.from("frequencia").select("presente, data, matricula_id")),
    fetchAll<RawNota>(() => client.from("notas").select("matricula_id, nota_1, nota_2, nota_3, nota_4")),
  ]);

  const snapshots: AlertaSnapshot[] = [];
  const avgMap = computeAvg(notas);
  const presence = computePresence(freq);

  // ── 1) Alunos em alto risco (individual) ─────────────────────────────
  const alunosRisco: Array<{ id: string; nome: string; risco: number; freq: number; consec: number; turmaId: string; unidade: string }> = [];
  matriculas
    .filter((m) => m.status === "ativa" && m.aluno && m.turma)
    .forEach((m) => {
      const p = presence.totalMap.get(m.id);
      const freqPct = p?.total ? (p.pres / p.total) * 100 : 100;
      const media = avgMap.get(m.id) ?? null;
      const consec = presence.consec.get(m.id) ?? 0;
      const fScore = Math.max(0, 100 - freqPct);
      const nScore = media === null ? 30 : Math.max(0, (10 - media) * 10);
      const cScore = Math.min(100, consec * 15);
      const risk = Math.round(fScore * 0.5 + nScore * 0.3 + cScore * 0.2);
      if (risk >= 70) {
        alunosRisco.push({
          id: m.aluno!.id,
          nome: m.aluno!.nome_aluno,
          risco: risk,
          freq: Math.round(freqPct),
          consec,
          turmaId: m.turma!.id,
          unidade: `${m.turma!.unidade?.nome_unidade ?? "—"}/${m.turma!.unidade?.estado ?? ""}`,
        });
      }
    });

  alunosRisco.forEach((a) => {
    snapshots.push({
      tipo: "risco-aluno",
      severity: a.risco >= 85 ? "critico" : "atencao",
      entidade: "aluno",
      entidade_id: a.id,
      titulo: `${a.nome} em risco de evasão`,
      descricao: `Score ${a.risco}/100 — frequência ${a.freq}%, ${a.consec} falta(s) consecutiva(s).`,
      unidade: a.unidade,
      unidade_id: null,
      metricas: { risco: a.risco, frequencia_pct: a.freq, faltas_consec: a.consec },
    });
  });

  // ── 2) Turmas com frequência baixa ───────────────────────────────────
  const byTurma = new Map<string, { total: number; pres: number; nome: string; unit: string; unitId: string | null }>();
  matriculas.forEach((m) => {
    if (!m.turma) return;
    const cur = byTurma.get(m.turma.id) ?? {
      total: 0,
      pres: 0,
      nome: m.turma.nome_turma,
      unit: `${m.turma.unidade?.nome_unidade ?? "—"}/${m.turma.unidade?.estado ?? ""}`,
      unitId: m.turma.unidade?.id ?? null,
    };
    byTurma.set(m.turma.id, cur);
  });
  const matToTurma = new Map<string, string>();
  matriculas.forEach((m) => { if (m.turma) matToTurma.set(m.id, m.turma.id); });
  freq.forEach((f) => {
    const tid = matToTurma.get(f.matricula_id);
    if (!tid) return;
    const cur = byTurma.get(tid);
    if (!cur) return;
    cur.total += 1;
    if (f.presente) cur.pres += 1;
  });
  byTurma.forEach((v, turmaId) => {
    if (v.total < 5) return;
    const pct = (v.pres / v.total) * 100;
    if (pct < 60) {
      snapshots.push({
        tipo: "freq-turma",
        severity: "critico",
        entidade: "turma",
        entidade_id: turmaId,
        titulo: `Turma ${v.nome} com frequência crítica`,
        descricao: `Frequência média de ${pct.toFixed(1)}% nas últimas aulas.`,
        unidade: v.unit,
        unidade_id: v.unitId,
        metricas: { frequencia_pct: Number(pct.toFixed(1)), aulas: v.total, presencas: v.pres },
      });
    } else if (pct < 75) {
      snapshots.push({
        tipo: "freq-turma",
        severity: "atencao",
        entidade: "turma",
        entidade_id: turmaId,
        titulo: `Turma ${v.nome} com frequência abaixo do ideal`,
        descricao: `Frequência média de ${pct.toFixed(1)}%.`,
        unidade: v.unit,
        unidade_id: v.unitId,
        metricas: { frequencia_pct: Number(pct.toFixed(1)), aulas: v.total, presencas: v.pres },
      });
    }
  });

  // ── 3) Turmas com baixa ocupação ─────────────────────────────────────
  const ocup = new Map<string, { cap: number; ativos: number; nome: string; unit: string; unitId: string | null }>();
  matriculas.forEach((m) => {
    if (!m.turma) return;
    const cur = ocup.get(m.turma.id) ?? {
      cap: m.turma.capacidade,
      ativos: 0,
      nome: m.turma.nome_turma,
      unit: `${m.turma.unidade?.nome_unidade ?? "—"}/${m.turma.unidade?.estado ?? ""}`,
      unitId: m.turma.unidade?.id ?? null,
    };
    if (m.status === "ativa") cur.ativos += 1;
    ocup.set(m.turma.id, cur);
  });
  ocup.forEach((v, turmaId) => {
    if (v.cap === 0) return;
    const pct = (v.ativos / v.cap) * 100;
    if (pct < 40) {
      snapshots.push({
        tipo: "ocup-turma",
        severity: "atencao",
        entidade: "turma",
        entidade_id: turmaId,
        titulo: `Turma ${v.nome} com baixa ocupação`,
        descricao: `Ocupação atual de ${v.ativos}/${v.cap} (${pct.toFixed(0)}%).`,
        unidade: v.unit,
        unidade_id: v.unitId,
        metricas: { ocupacao_pct: Number(pct.toFixed(1)), ativos: v.ativos, capacidade: v.cap },
      });
    }
  });

  return snapshots;
}