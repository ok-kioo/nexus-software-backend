import { HTTPException } from "hono/http-exception";
import { createAdminClient } from "../supabase-client";
import { derivePrimaryRole, type UserRole } from "../../shared/roles";
import { dbError } from "../../shared/db-errors";
import type { UserRepository, UserDetail } from "../../../modules/users/domain/user.repository";
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

  async getById(userId: string): Promise<UserDetail | null> {
    const admin = createAdminClient();
    const [{ data: profile, error: pErr }, { data: roles, error: rErr }, { data: turmas, error: tErr }] =
      await Promise.all([
        admin.from("profiles").select("id, name, email").eq("id", userId).maybeSingle(),
        admin.from("user_roles").select("role").eq("user_id", userId),
        admin.from("turma_professores").select("turma_id").eq("professor_id", userId),
      ]);
    if (pErr) throw dbError(pErr);
    if (rErr) throw dbError(rErr);
    if (tErr) throw dbError(tErr);
    if (!profile) return null;
    const roleList = (roles ?? []).map((r) => r.role as UserRole);
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: roleList.length ? derivePrimaryRole(roleList) : null,
      turma_ids: (turmas ?? []).map((t) => t.turma_id),
    };
  }

  async updateProfile(userId: string, patch: { name?: string; email?: string }) {
    const admin = createAdminClient();
    const set: Record<string, string> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.email !== undefined) set.email = patch.email;
    if (Object.keys(set).length === 0) return;
    const { error } = await admin.from("profiles").update(set).eq("id", userId);
    if (error) throw dbError(error);
  }

  async updateAuthEmail(userId: string, email: string) {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) throw new HTTPException(400, { message: error.message });
  }

  async replaceTurmas(userId: string, turmaIds: string[]) {
    const admin = createAdminClient();
    const { error: delErr } = await admin
      .from("turma_professores")
      .delete()
      .eq("professor_id", userId);
    if (delErr) throw dbError(delErr);
    if (turmaIds.length === 0) return;
    const rows = turmaIds.map((id) => ({ professor_id: userId, turma_id: id }));
    const { error: insErr } = await admin.from("turma_professores").insert(rows);
    if (insErr) throw dbError(insErr);
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
