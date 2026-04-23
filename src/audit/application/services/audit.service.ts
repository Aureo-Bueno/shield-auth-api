import { Injectable } from '@nestjs/common';
import { AuditEvent, CreateAuditEventInput } from '../../domain/audit-event.entity';
import { ListAuditEventsUseCase } from '../use-cases/list-audit-events.use-case';
import { RecordAuditEventUseCase } from '../use-cases/record-audit-event.use-case';

@Injectable()
export class AuditService {
  constructor(
    private readonly recordAuditEventUseCase: RecordAuditEventUseCase,
    private readonly listAuditEventsUseCase: ListAuditEventsUseCase,
  ) {}

  record(input: CreateAuditEventInput): AuditEvent {
    return this.recordAuditEventUseCase.execute(input);
  }

  list(limit = 50): AuditEvent[] {
    return this.listAuditEventsUseCase.execute(limit);
  }
}
