import { z } from "zod";
import { RoleSchema } from "../../../infra/http/auth-middleware";

export const UpdateRoleSchema = z.object({ role: RoleSchema });
export type UpdateRoleDTO = z.infer<typeof UpdateRoleSchema>;

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  role: RoleSchema.optional(),
  turma_ids: z.array(z.string().uuid()).optional(),
});
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;

export const UpdateMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
});
export type UpdateMeDTO = z.infer<typeof UpdateMeSchema>;

// Same rule as signup: at least 8 chars, with letter and number.
export const PasswordSchema = z
  .string()
  .min(8, { message: "A senha deve ter pelo menos 8 caracteres." })
  .max(72, { message: "A senha não pode passar de 72 caracteres." })
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "A senha precisa conter letras e números.",
  });

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Informe a senha atual." }),
  newPassword: PasswordSchema,
});
export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>;
