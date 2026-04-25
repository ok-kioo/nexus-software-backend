import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuth, requireRole } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES } from "../../../infra/shared/roles";
import { UpdateRoleSchema } from "../dto/user.dto";
import { userRepository } from "../domain/user.repository";
import { listUsersWithRolesCase } from "../cases/list-users-with-roles.case";
import { updateUserRoleCase } from "../cases/update-user-role.case";

export function userController(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const rows = await listUsersWithRolesCase(userRepository);
    return c.json({ rows });
  });

  router.patch("/:id/role", async (c) => {
    const { user } = getAuth(c);
    requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = UpdateRoleSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const result = await updateUserRoleCase(userRepository, user.role, c.req.param("id"), parsed.data.role);
    return c.json(result);
  });

  return router;
}