import {
  AuditEvent,
  CreateAuditEventInput,
} from '../../domain/audit-event.entity';

export const AUDIT_EVENT_REPOSITORY = 'AUDIT_EVENT_REPOSITORY';

export interface AuditEventRepositoryPort {
  save(input: CreateAuditEventInput): AuditEvent;
  list(limit: number): AuditEvent[];
}
