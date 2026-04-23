import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditEvent,
  CreateAuditEventInput,
} from '../../domain/audit-event.entity';
import { AuditEventRepositoryPort } from '../../application/ports/audit-event-repository.port';

@Injectable()
export class InMemoryAuditEventRepository implements AuditEventRepositoryPort {
  private readonly logger = new Logger(InMemoryAuditEventRepository.name);
  private readonly events: AuditEvent[] = [];
  private readonly maxEvents: number;
  private sequence = 0;

  constructor(private readonly configService: ConfigService) {
    const configuredMax =
      this.configService.get<string>('AUDIT_MAX_EVENTS') ?? '1000';
    const maxEvents = Number(configuredMax);
    if (
      !Number.isFinite(maxEvents) ||
      maxEvents <= 0 ||
      !Number.isInteger(maxEvents)
    ) {
      throw new Error('AUDIT_MAX_EVENTS must be a positive integer');
    }
    this.maxEvents = maxEvents;
  }

  save(input: CreateAuditEventInput): AuditEvent {
    const event: AuditEvent = {
      id: this.sequence,
      timestamp: new Date().toISOString(),
      ...input,
    };

    this.sequence += 1;
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }

    this.logger.log({
      event: 'audit',
      ...event,
    });

    return event;
  }

  list(limit: number): AuditEvent[] {
    return [...this.events].slice(-limit).reverse();
  }
}
