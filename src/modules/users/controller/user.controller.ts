import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuth, requireRole } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES, READ_ALL_ROLES } from "../../../infra/shared/roles";
import {
  UpdateRoleSchema,
  UpdateUserSchema,
  UpdateMeSchema,
  ChangePasswordSchema,
} from "../dto/user.dto";
import { UpdateOnboardingSchema } from "../dto/onboarding.dto";
import { userRepository } from "../domain/user.repository";
import { listUsersWithRolesCase } from "../cases/list-users-with-roles.case";
import { updateUserRoleCase } from "../cases/update-user-role.case";
import { updateUserCase } from "../cases/update-user.case";
import { changeOwnPasswordCase } from "../cases/change-password.case";
import { getOnboardingCase } from "../cases/get-onboarding.case";
import { updateOnboardingCase } from "../cases/update-onboarding.case";

export function userController(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const rows = await listUsersWithRolesCase(userRepository);
    return c.json({ rows });
  });

  // ── Self-service ───────────────────────────────────────────
  router.patch("/me", async (c) => {
    const { user } = getAuth(c);
    const parsed = UpdateMeSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    // Email só admin pode trocar (próprio inclusive — segurança).
    const result = await updateUserCase(
      userRepository,
      user.role,
      user.id,
      user.id,
      parsed.data,
    );
    return c.json(result);
  });

  router.post("/me/password", async (c) => {
    const { user } = getAuth(c);
    const parsed = ChangePasswordSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const result = await changeOwnPasswordCase(
      user.id,
      user.email,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    return c.json(result);
  });

    // ── Onboarding (self) ──────────────────────────────────────
  router.get("/me/onboarding", async (c) => {
    const { user } = getAuth(c);
    const state = await getOnboardingCase(userRepository, user.id);
    return c.json(state);
  });
  router.patch("/me/onboarding", async (c) => {
    const { user } = getAuth(c);
    const parsed = UpdateOnboardingSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const state = await updateOnboardingCase(userRepository, user.id, parsed.data);
    return c.json(state);
  });


  // ── Detail / edit ──────────────────────────────────────────
  router.get("/:id", async (c) => {
    requireRole(c, ADMIN_GESTOR_ROLES);
    const detail = await userRepository.getById(c.req.param("id"));
    if (!detail) throw new HTTPException(404, { message: "Usuário não encontrado" });
    return c.json(detail);
  });

  router.patch("/:id", async (c) => {
    const { user } = getAuth(c);
    requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = UpdateUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const result = await updateUserCase(
      userRepository,
      user.role,
      user.id,
      c.req.param("id"),
      parsed.data,
    );
    return c.json(result);
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
