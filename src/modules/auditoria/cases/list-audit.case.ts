import type { AuditFilters } from "../domain/audit-log.entity";
import type { AuditLogRepository } from "../domain/audit-log.repository";

export const listAuditCase = (repo: AuditLogRepository, filters: AuditFilters) => repo.list(filters);