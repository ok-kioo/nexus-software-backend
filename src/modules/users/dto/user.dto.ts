import { z } from "zod";
import { RoleSchema } from "../../../infra/http/auth-middleware";

export const UpdateRoleSchema = z.object({ role: RoleSchema });
export type UpdateRoleDTO = z.infer<typeof UpdateRoleSchema>;