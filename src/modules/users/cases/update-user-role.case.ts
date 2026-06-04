import { HTTPException } from "hono/http-exception";
import { canAssignRole, USER_ROLES, type UserRole } from "../../../infra/shared/roles";
import type { UserRepository } from "../domain/user.repository";

/**
 * Hierarquia (mais alto → mais baixo): administrador > gestor > professor.
 * Um caller só pode modificar usuários com hierarquia estritamente inferior à sua.
 */
const HIERARCHY: UserRole[] = ["administrador", "gestor", "professor"];

function rank(role: UserRole | null): number {
  if (role === null) return HIERARCHY.length; // sem papel = mais baixo possível
  const idx = HIERARCHY.indexOf(role);
  return idx === -1 ? HIERARCHY.length : idx;
}

export async function updateUserRoleCase(
  repo: UserRepository,
  assignerRole: UserRole,
  userId: string,
  targetRole: UserRole,
) {
  // 1. Verifica se o assigner pode atribuir o novo papel.
  if (!canAssignRole(assignerRole, targetRole)) {
    throw new HTTPException(403, { message: "Você não pode atribuir esse papel" });
  }

  // 2. Bloqueia escalada/demoção lateral: o papel ATUAL do alvo deve ser
  //    estritamente inferior ao do assigner. Sem essa checagem, um gestor
  //    poderia rebaixar um administrador para professor.
  const currentRole = await repo.getCurrentRole(userId);
  if (rank(currentRole) <= rank(assignerRole) && assignerRole !== "administrador") {
    throw new HTTPException(403, {
      message: "Você não pode modificar o papel de um usuário com permissão igual ou maior",
    });
  }
  // Mesmo administradores não devem poder se auto-rebaixar acidentalmente
  // via este endpoint — exigimos um endpoint separado para isso (não implementado).
  if (currentRole === "administrador" && targetRole !== "administrador") {
    throw new HTTPException(403, {
      message: "Não é possível remover privilégios de administrador por este endpoint",
    });
  }
  // Sanity check: papel-alvo está no enum suportado
  if (!USER_ROLES.includes(targetRole)) {
    throw new HTTPException(400, { message: "Papel inválido" });
  }

  await repo.replaceRole(userId, targetRole);
  return { ok: true, role: targetRole };
}