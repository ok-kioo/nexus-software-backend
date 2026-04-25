import type { ImportEntityKey } from "../../../infra/shared/import-validators";
import type { ParsedSheetData } from "./parse-workbook.case";
import type { ValidationError } from "../domain/import-job.entity";
import { runWithConcurrency, chunk } from "../../../infra/shared/parallel";

const REQUIRED: Record<ImportEntityKey, string[]> = {
  unidades: ["nome_unidade", "cidade", "estado"],
  cursos: ["nome_curso", "categoria"],
  turmas: ["nome_turma", "nome_unidade", "nome_curso"],
  alunos: ["nome_aluno", "documento"],
  matriculas: ["numero_matricula", "nome_aluno", "nome_turma"],
  frequencia: ["nome_aluno", "nome_turma", "data", "presente"],
  notas: ["nome_aluno", "nome_turma"],
};

const PRESENCA_OK = new Set([
  "true", "false", "1", "0", "sim", "nao", "não", "presente", "ausente",
]);

const CHUNK = 1000;
const PARALLEL = 4;

function isEmpty(v: unknown) {
  return v === undefined || v === null || String(v).trim() === "";
}

/** Valida um chunk de linhas e retorna apenas as válidas + erros encontrados. */
function validateChunk(
  entity: ImportEntityKey,
  rows: Record<string, unknown>[],
  baseIndex: number,
  sheetName: string,
): { valid: Record<string, unknown>[]; errors: ValidationError[] } {
  const required = REQUIRED[entity];
  const errors: ValidationError[] = [];
  const valid: Record<string, unknown>[] = [];

  rows.forEach((row, i) => {
    const rowNum = baseIndex + i + 2; // +2 = header + 1-based
    let ok = true;
    for (const field of required) {
      if (isEmpty(row[field])) {
        errors.push({ sheet: sheetName, row: rowNum, field, message: `Campo obrigatório vazio: ${field}` });
        ok = false;
      }
    }

    if (entity === "frequencia") {
      const p = String(row.presente ?? "").toLowerCase().trim();
      if (p && !PRESENCA_OK.has(p)) {
        errors.push({
          sheet: sheetName, row: rowNum, field: "presente",
          message: `Valor de presença inválido: "${row.presente}" (use sim/não, true/false, 1/0)`,
        });
        ok = false;
      }
    }

    if (entity === "notas") {
      const slots = ["nota_1", "nota_2", "nota_3", "nota_4"];
      const filled = slots.filter((s) => !isEmpty(row[s]));
      if (filled.length === 0) {
        errors.push({ sheet: sheetName, row: rowNum, field: "nota_*", message: "Nenhuma nota preenchida" });
        ok = false;
      }
      for (const slot of filled) {
        const n = Number(String(row[slot]).replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > 10) {
          errors.push({
            sheet: sheetName, row: rowNum, field: slot,
            message: `Nota inválida em ${slot}: "${row[slot]}" (esperado 0–10)`,
          });
          ok = false;
        }
      }
    }

    if (ok) valid.push(row);
  });

  return { valid, errors };
}

export interface ValidatedEntity {
  entity: ImportEntityKey;
  sheetName: string;
  rows: Record<string, unknown>[];
  errors: ValidationError[];
}

/** Valida cada aba conhecida em paralelo (chunks). Aplica regras cross-row depois. */
export async function validateWorkbook(
  sheets: ParsedSheetData[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ entities: ValidatedEntity[]; errors: ValidationError[] }> {
  const known = sheets.filter((s) => s.entity !== null) as Array<ParsedSheetData & { entity: ImportEntityKey }>;
  const totalChunks = known.reduce((a, s) => a + Math.ceil(s.rows.length / CHUNK), 0) || 1;
  let done = 0;

  const entities: ValidatedEntity[] = [];
  const allErrors: ValidationError[] = [];

  for (const sheet of known) {
    const chunks = chunk(sheet.rows, CHUNK);
    const partials = await runWithConcurrency(chunks, PARALLEL, async (rows, idx) => {
      const result = validateChunk(sheet.entity, rows, idx * CHUNK, sheet.sheetName);
      done++;
      onProgress?.(done, totalChunks);
      return result;
    });

    const validRows = partials.flatMap((p) => p.valid);
    const errors = partials.flatMap((p) => p.errors);

    // Regras cross-row
    if (sheet.entity === "matriculas") {
      const seen = new Map<string, number>();
      validRows.forEach((r, i) => {
        const num = String(r.numero_matricula ?? "").trim();
        if (!num) return;
        const prev = seen.get(num);
        if (prev !== undefined) {
          errors.push({
            sheet: sheet.sheetName, row: i + 2, field: "numero_matricula",
            message: `Número de matrícula ${num} duplicado (linha ${prev}).`,
          });
        } else seen.set(num, i + 2);
      });
    }

    if (sheet.entity === "notas") {
      const sizesByTurma = new Map<string, Set<number>>();
      validRows.forEach((r) => {
        const turma = String(r.nome_turma ?? "").trim();
        if (!turma) return;
        const filled = ["nota_1", "nota_2", "nota_3", "nota_4"].filter((s) => !isEmpty(r[s])).length;
        if (!sizesByTurma.has(turma)) sizesByTurma.set(turma, new Set());
        sizesByTurma.get(turma)!.add(filled);
      });
      for (const [turma, sizes] of sizesByTurma) {
        if (sizes.size > 1) {
          errors.push({
            sheet: sheet.sheetName, row: 0, field: "nota_*",
            message: `Turma "${turma}" tem alunos com quantidades diferentes de notas (${[...sizes].join(", ")}).`,
          });
        }
      }
    }

    entities.push({ entity: sheet.entity, sheetName: sheet.sheetName, rows: validRows, errors });
    allErrors.push(...errors);
  }

  return { entities, errors: allErrors };
}