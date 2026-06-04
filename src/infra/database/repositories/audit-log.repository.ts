import { createAdminClient } from "../supabase-client";
import { dbError } from "../../shared/db-errors";
import type { AuditLogRepository } from "../../../modules/auditoria/domain/audit-log.repository";
import type { AuditFilters } from "../../../modules/auditoria/domain/audit-log.entity";

export class SupabaseAuditLogRepository implements AuditLogRepository {
  async list({ entidade, acao, user_id, limit = 500 }: AuditFilters) {
    const lim = Math.min(2000, Math.max(1, limit));
    const admin = createAdminClient();
    let q = admin.from("audit_log").select("*").order("created_at", { ascending: false }).limit(lim);
    if (entidade) q = q.eq("entidade", entidade);
    if (acao) q = q.eq("acao", acao);
    if (user_id) q = q.eq("user_id", user_id);
    const { data, error } = await q;
    if (error) throw dbError(error);
    return data ?? [];
  }
}

export const auditLogRepository: AuditLogRepository = new SupabaseAuditLogRepository();
