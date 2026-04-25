import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { ImportEntityKey } from "../../../infra/shared/import-validators";

export interface ParsedSheetData {
  sheetName: string;
  entity: ImportEntityKey | null;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParseResult {
  sheets: ParsedSheetData[];
  totalRows: number;
}

const MAX_SHEETS = 30;
const MAX_ROWS_PER_SHEET = 500_000;
const MAX_COLS_PER_SHEET = 200;
const MAX_CELL_LEN = 10_000;
const ZIP_SIG = [0x50, 0x4b, 0x03, 0x04];

function detectEntity(name: string): ImportEntityKey | null {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const map: Record<string, ImportEntityKey> = {
    unidades: "unidades", unidade: "unidades", campus: "unidades", polos: "unidades", polo: "unidades",
    cursos: "cursos", curso: "cursos", programas: "cursos",
    turmas: "turmas", turma: "turmas", classes: "turmas", classe: "turmas",
    alunos: "alunos", aluno: "alunos", estudantes: "alunos", discentes: "alunos",
    matriculas: "matriculas", matricula: "matriculas",
    frequencia: "frequencia", presencas: "frequencia", freq: "frequencia",
    notas: "notas", nota: "notas", avaliacoes: "notas", boletim: "notas",
  };
  if (map[n]) return map[n];
  for (const k of Object.keys(map)) if (n.includes(k)) return map[k];
  return null;
}

/** Mitigação CSV-injection + truncamento. */
function sanitizeCell(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    // Fórmulas / rich text: extrair valor cru, NUNCA fórmula.
    const obj = v as { result?: unknown; text?: unknown; richText?: Array<{ text?: string }>; hyperlink?: string };
    if (obj.result !== undefined) return sanitizeCell(obj.result);
    if (obj.text !== undefined) return sanitizeCell(obj.text);
    if (Array.isArray(obj.richText)) return sanitizeCell(obj.richText.map((r) => r.text ?? "").join(""));
    if (obj.hyperlink) return sanitizeCell(obj.hyperlink);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return null;
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  let s = String(v);
  if (s.length > MAX_CELL_LEN) s = s.slice(0, MAX_CELL_LEN);
  // CSV-injection: prefixa com apóstrofo se começa com caracteres perigosos
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/** Faz o parse streaming de um buffer .xlsx aplicando limites e sanitização. */
export async function parseWorkbook(buffer: Buffer): Promise<ParseResult> {
  // Magic bytes ZIP
  if (buffer.length < 4 || ZIP_SIG.some((b, i) => buffer[i] !== b)) {
    throw new ParseError("Arquivo não é um .xlsx válido (assinatura inválida).");
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    throw new ParseError(`Não foi possível ler o arquivo: ${(e as Error).message}`);
  }

  const worksheets = wb.worksheets;
  if (worksheets.length === 0) throw new ParseError("Arquivo sem abas.");
  if (worksheets.length > MAX_SHEETS) {
    throw new ParseError(`Arquivo tem ${worksheets.length} abas; máximo permitido: ${MAX_SHEETS}.`);
  }

  const sheets: ParsedSheetData[] = [];
  let totalRows = 0;

  for (const ws of worksheets) {
    const rowCount = ws.actualRowCount;
    if (rowCount > MAX_ROWS_PER_SHEET + 1) {
      throw new ParseError(
        `Aba "${ws.name}" tem ${rowCount} linhas; máximo: ${MAX_ROWS_PER_SHEET}.`,
      );
    }
    const colCount = ws.actualColumnCount;
    if (colCount > MAX_COLS_PER_SHEET) {
      throw new ParseError(
        `Aba "${ws.name}" tem ${colCount} colunas; máximo: ${MAX_COLS_PER_SHEET}.`,
      );
    }

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const v = sanitizeCell(cell.value);
      headers[col - 1] = v == null ? `col_${col}` : String(v).trim();
    });
    // Preenche gaps
    for (let i = 0; i < headers.length; i++) if (!headers[i]) headers[i] = `col_${i + 1}`;

    const rows: Record<string, unknown>[] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, unknown> = {};
      let hasAny = false;
      headers.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        const v = sanitizeCell(cell.value);
        if (v !== null && v !== "") hasAny = true;
        obj[h] = v;
      });
      if (hasAny) rows.push(obj);
    });

    sheets.push({
      sheetName: ws.name,
      entity: detectEntity(ws.name),
      headers,
      rows,
    });
    totalRows += rows.length;
  }

  return { sheets, totalRows };
}

// Mantido para uso futuro (stream do Storage diretamente)
export async function parseWorkbookStream(stream: Readable): Promise<ParseResult> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return parseWorkbook(Buffer.concat(chunks));
}