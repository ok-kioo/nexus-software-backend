import { HTTPException } from "hono/http-exception";
import { createAdminClient } from "../supabase-client";
import { derivePrimaryRole, type UserRole } from "../../shared/roles";
import { dbError } from "../../shared/db-errors";
import type { UserRepository } from "../../../modules/users/domain/user.repository";
import type { UserProfile } from "../../../modules/users/domain/user.entity";

export class SupabaseUserRepository implements UserRepository {
  async listWithRoles(): Promise<UserProfile[]> {
    const admin = createAdminClient();
    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
      admin.from("profiles").select("id, name, email").order("name"),
      admin.from("user_roles").select("user_id, role"),
    ]);
    if (profilesError) throw dbError(profilesError);
    if (rolesError) throw dbError(rolesError);

    const grouped = new Map<string, UserRole[]>();
    for (const item of roles ?? []) {
      const arr = grouped.get(item.user_id) ?? [];
      arr.push(item.role as UserRole);
      grouped.set(item.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: grouped.has(p.id) ? derivePrimaryRole(grouped.get(p.id)!) : null,
    }));
  }

  async getCurrentRole(userId: string): Promise<UserRole | null> {
    const admin = createAdminClient();
    const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw dbError(error);
    const list = (data ?? []).map((row) => row.role as UserRole);
    if (list.length === 0) return null;
    return derivePrimaryRole(list);
  }

  async replaceRole(userId: string, role: UserRole) {
    const admin = createAdminClient();
    const { data: existing, error: fetchErr } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId);
    if (fetchErr) throw dbError(fetchErr);
    if (!existing || existing.length === 0) {
      throw new HTTPException(404, { message: "Usuário não encontrado" });
    }
    for (const row of existing) {
      const { error } = await admin.from("user_roles").delete().eq("id", row.id);
      if (error) throw dbError(error);
    }
    const { error: insertErr } = await admin.from("user_roles").insert({ user_id: userId, role });
    if (insertErr) throw dbError(insertErr);
  }
}

export const userRepository: UserRepository = new SupabaseUserRepository();
