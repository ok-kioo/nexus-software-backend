import { HTTPException } from "hono/http-exception";
import type { UserRepository } from "../domain/user.repository";
import type { UserRole } from "../../../infra/shared/roles";
import { updateUserRoleCase } from "./update-user-role.case";

const HIERARCHY: UserRole[] = ["administrador", "gestor", "professor"];
function rank(role: UserRole | null): number {
  if (role === null) return HIERARCHY.length;
  const idx = HIERARCHY.indexOf(role);
  return idx === -1 ? HIERARCHY.length : idx;
}

export interface UpdateUserPatch {
  name?: string;
  email?: string;
  role?: UserRole;
  turma_ids?: string[];
}

/**
 * Editor único de usuário. Valida hierarquia antes de aplicar qualquer alteração.
 * - admin pode editar qualquer um (exceto se o alvo já for admin e a mudança remover privilégios — bloqueado em updateUserRoleCase).
 * - gestor só pode editar professores.
 * - email só pode ser alterado por administrador.
 */
export async function updateUserCase(
  repo: UserRepository,
  assignerRole: UserRole,
  assignerId: string,
  targetUserId: string,
  patch: UpdateUserPatch,
) {
  const target = await repo.getById(targetUserId);
  if (!target) throw new HTTPException(404, { message: "Usuário não encontrado" });

  // Hierarquia: assigner deve estar estritamente acima do alvo (a não ser auto-edição).
  const isSelf = assignerId === targetUserId;
  if (!isSelf && rank(target.role) <= rank(assignerRole) && assignerRole !== "administrador") {
    throw new HTTPException(403, {
      message: "Sem permissão para editar este usuário",
    });
  }
  if (assignerRole === "gestor" && target.role !== "professor" && !isSelf) {
    throw new HTTPException(403, { message: "Gestores só podem editar professores" });
  }

  // E-mail: apenas administrador.
  if (patch.email && patch.email !== target.email) {
    if (assignerRole !== "administrador") {
      throw new HTTPException(403, { message: "Apenas administradores podem alterar e-mail" });
    }
    await repo.updateAuthEmail(targetUserId, patch.email);
  }

  // Nome / e-mail no profile.
  const profilePatch: { name?: string; email?: string } = {};
  if (patch.name && patch.name !== target.name) profilePatch.name = patch.name;
  if (patch.email && patch.email !== target.email) profilePatch.email = patch.email;
  if (Object.keys(profilePatch).length > 0) {
    await repo.updateProfile(targetUserId, profilePatch);
  }

  // Role.
  let finalRole: UserRole | null = target.role;
  if (patch.role && patch.role !== target.role) {
    await updateUserRoleCase(repo, assignerRole, targetUserId, patch.role);
    finalRole = patch.role;
  }

  // Turmas (somente quando o papel resultante é professor).
  if (patch.turma_ids !== undefined) {
    if (finalRole !== "professor") {
      // Sem-op: papel não-professor não tem turmas. Limpa de qualquer forma para coerência.
      await repo.replaceTurmas(targetUserId, []);
    } else {
      await repo.replaceTurmas(targetUserId, patch.turma_ids);
    }
  }

  const updated = await repo.getById(targetUserId);
  return { ok: true, user: updated };
}
