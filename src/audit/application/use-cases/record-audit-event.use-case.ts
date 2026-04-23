import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_EVENT_REPOSITORY } from '../ports/audit-event-repository.port';
import type { AuditEventRepositoryPort } from '../ports/audit-event-repository.port';
import {
  AuditEvent,
  CreateAuditEventInput,
} from '../../domain/audit-event.entity';

@Injectable()
export class RecordAuditEventUseCase {
  constructor(
    @Inject(AUDIT_EVENT_REPOSITORY)
    private readonly repository: AuditEventRepositoryPort,
  ) {}

  execute(input: CreateAuditEventInput): AuditEvent {
    return this.repository.save(input);
  }
}
