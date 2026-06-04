import { z } from "zod";
import { RoleSchema } from "../../../infra/http/auth-middleware";

export const InviteCreateSchema = z.object({
  email: z.email(),
  role: RoleSchema,
  turma_ids: z.array(z.string().uuid()).optional().default([]),
});

export const InviteResendSchema = z.object({
  email: z.email().optional(),
  role: RoleSchema.optional(),
  resend_id: z.string().uuid().optional(),
});

export const AcceptInviteSchema = z.object({
  token: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8),
});

export const TestInviteSchema = z.object({
  scenario: z.enum(["expirado", "cancelado", "aceito"]),
});