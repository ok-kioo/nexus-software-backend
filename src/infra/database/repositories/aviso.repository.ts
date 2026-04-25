import { createAdminClient } from "../supabase-client";
import type { UserRole } from "../../shared/roles";
import { dbError } from "../../shared/db-errors";
import type { AvisoRepository } from "../../../modules/avisos/domain/aviso.repository";
import type { AvisoCreateDTO, AvisoUpdateDTO } from "../../../modules/avisos/dto/aviso.dto";

export class SupabaseAvisoRepository implements AvisoRepository {
  async list() {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("avisos")
      .select("*")
      .order("fixado", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw dbError(error);
    return data ?? [];
  }
  async create(dto: AvisoCreateDTO, autorId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin.from("avisos").insert({ ...dto, autor_id: autorId }).select().maybeSingle();
    if (error) throw dbError(error, 400);
    return data;
  }
  async update(id: string, dto: AvisoUpdateDTO, role: UserRole, userId: string) {
    const admin = createAdminClient();
    let q = admin.from("avisos").update(dto).eq("id", id);
    if (role === "gestor") q = q.eq("autor_id", userId);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw dbError(error, 400);
    return data;
  }
  async delete(id: string, role: UserRole, userId: string) {
    const admin = createAdminClient();
    let q = admin.from("avisos").delete().eq("id", id);
    if (role === "gestor") q = q.eq("autor_id", userId);
    const { error } = await q;
    if (error) throw dbError(error, 400);
  }
  async listLeituras(userId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin.from("avisos_leituras").select("aviso_id").eq("user_id", userId);
    if (error) throw dbError(error);
    return data ?? [];
  }
  async markRead(avisoId: string, userId: string) {
    const admin = createAdminClient();
    const { error } = await admin.from("avisos_leituras").insert({ aviso_id: avisoId, user_id: userId });
    if (error && error.code !== "23505") throw dbError(error, 400);
  }
}

export const avisoRepository: AvisoRepository = new SupabaseAvisoRepository();
