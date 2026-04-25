import type { AuditFilters } from "./audit-log.entity";

export interface AuditLogRepository {
  list(filters: AuditFilters): Promise<unknown[]>;
}

export { auditLogRepository } from "../../../infra/database/repositories/audit-log.repository";