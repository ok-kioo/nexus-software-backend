/**
 * Roles fixas do sistema. Não há CRUD para roles — o conjunto é constante.
 */
export const USER_ROLES = ["administrador", "gestor", "professor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const rolePriority: UserRole[] = ["administrador", "gestor", "professor"];

export function derivePrimaryRole(roles: UserRole[]): UserRole {
  return rolePriority.find((role) => roles.includes(role)) ?? "professor";
}

export function canAssignRole(assignerRole: UserRole, targetRole: UserRole) {
  if (assignerRole === "administrador") return true;
  if (assignerRole === "gestor" && targetRole === "professor") return true;
  return false;
}

export const READ_ALL_ROLES: UserRole[] = ["administrador", "gestor", "professor"];
export const ADMIN_GESTOR_ROLES: UserRole[] = ["administrador", "gestor"];
export const ADMIN_ONLY: UserRole[] = ["administrador"];