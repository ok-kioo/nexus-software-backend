import { z } from "zod";

/**
 * Remove caracteres de controle (\u0000-\u001F) exceto \n (0x0A) e \t (0x09).
 * Defesa em profundidade contra injeção de control chars em prompts/banco.
 */
export function sanitizeContent(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
}

export const CapeloSendSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Mensagem não pode ser vazia")
    .max(4000, "Mensagem excede o limite de 4000 caracteres"),
});

export type CapeloSendDTO = z.infer<typeof CapeloSendSchema>;

export const CapeloListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(),
});

export type CapeloListQuery = z.infer<typeof CapeloListQuerySchema>;

export interface CapeloMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}
