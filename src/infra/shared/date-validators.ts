import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Retorna a data de hoje no formato YYYY-MM-DD (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** String YYYY-MM-DD que representa uma data válida do calendário. */
export const IsoDateString = z
  .string({ message: "Data é obrigatória." })
  .trim()
  .refine((v) => ISO_DATE_RE.test(v), {
    message: "Data inválida (use o formato AAAA-MM-DD).",
  })
  .refine(
    (v) => {
      const [y, m, d] = v.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
      );
    },
    { message: "Data inexistente no calendário." },
  );

/** Data que deve ser hoje ou no futuro. */
export const FutureOrTodayDate = IsoDateString.refine(
  (v) => v >= todayIso(),
  { message: "A data não pode estar no passado." },
);

/** Data que deve ser hoje ou no passado. */
export const PastOrTodayDate = IsoDateString.refine(
  (v) => v <= todayIso(),
  { message: "A data não pode estar no futuro." },
);
