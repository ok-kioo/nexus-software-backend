import { z } from "zod";

export const ImportEntity = z.enum([
  "unidades",
  "cursos",
  "turmas",
  "alunos",
  "matriculas",
  "frequencia",
  "notas",
]);
export type ImportEntityKey = z.infer<typeof ImportEntity>;

export const ImportRowSchema = z.record(z.string(), z.unknown());

export const ImportPreviewBody = z.object({
  entity: ImportEntity,
  rows: z.array(ImportRowSchema),
});

export const ImportCommitBody = z.object({
  batches: z
    .array(
      z.object({
        entity: ImportEntity,
        rows: z.array(ImportRowSchema),
      }),
    )
    .min(1),
});

export const COMMIT_ORDER: ImportEntityKey[] = [
  "unidades",
  "cursos",
  "turmas",
  "alunos",
  "matriculas",
  "frequencia",
  "notas",
];

export interface EntityResult {
  entity: ImportEntityKey;
  inserted: number;
  skipped: number;
  errors: string[];
}

export const norm = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === ""
    ? null
    : String(v).trim();

export const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;

  const value = String(v)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return String(value).trim() || null;
};

export const lookupNorm = (v: unknown): string | null => {
  const value = text(v);

  if (!value) return null;

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

export const numOrNull = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const boolFromCell = (v: unknown): boolean => {
  const s = String(v ?? "").toLowerCase().trim();
  return ["true", "1", "sim", "presente", "s", "yes", "y"].includes(s);
};

export const dateOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};