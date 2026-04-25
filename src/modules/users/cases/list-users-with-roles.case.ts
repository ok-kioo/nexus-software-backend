import type { UserRepository } from "../domain/user.repository";
export const listUsersWithRolesCase = (repo: UserRepository) => repo.listWithRoles();