import type { AppUser } from "../infra/shared/types";
import type { UserRole } from "../infra/shared/roles";

export function makeUser(role: UserRole = "administrador", overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@test.com",
    name: "Usuário Teste",
    roles: [role],
    role,
    ...overrides,
  };
}
