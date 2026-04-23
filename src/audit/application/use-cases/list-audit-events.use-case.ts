import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_EVENT_REPOSITORY } from '../ports/audit-event-repository.port';
import type { AuditEventRepositoryPort } from '../ports/audit-event-repository.port';
import { AuditEvent } from '../../domain/audit-event.entity';

@Injectable()
export class ListAuditEventsUseCase {
  constructor(
    @Inject(AUDIT_EVENT_REPOSITORY)
    private readonly repository: AuditEventRepositoryPort,
  ) {}

  execute(limit = 50): AuditEvent[] {
    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    return this.repository.list(boundedLimit);
  }
}
