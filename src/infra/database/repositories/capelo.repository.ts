import { createAdminClient } from "../supabase-client";
import { dbError } from "../../shared/db-errors";
import type { CapeloRepository } from "../../../modules/capelo/domain/capelo.repository";
import type { CapeloMessage } from "../../../modules/capelo/dto/capelo.dto";

export class SupabaseCapeloRepository implements CapeloRepository {
  async list(userId: string, params: { limit: number; before?: string }): Promise<CapeloMessage[]> {
    const admin = createAdminClient();
    let q = admin
      .from("capelo_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(params.limit);
    if (params.before) q = q.lt("created_at", params.before);
    const { data, error } = await q;
    if (error) throw dbError(error);
    // Inverter para ordem cronológica asc
    return ((data ?? []) as CapeloMessage[]).slice().reverse();
  }

  async insert(userId: string, role: CapeloMessage["role"], content: string): Promise<CapeloMessage> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("capelo_messages")
      .insert({ user_id: userId, role, content })
      .select("id, role, content, created_at")
      .single();
    if (error) throw dbError(error, 400);
    return data as CapeloMessage;
  }

  async clear(userId: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("capelo_messages").delete().eq("user_id", userId);
    if (error) throw dbError(error, 400);
  }
}

export const capeloRepository: CapeloRepository = new SupabaseCapeloRepository();
