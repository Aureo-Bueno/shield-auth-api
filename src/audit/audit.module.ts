import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthorizationModule } from '../auth/authorization/authorization.module';
import { AUDIT_EVENT_REPOSITORY } from './application/ports/audit-event-repository.port';
import { ListAuditEventsUseCase } from './application/use-cases/list-audit-events.use-case';
import { RecordAuditEventUseCase } from './application/use-cases/record-audit-event.use-case';
import { InMemoryAuditEventRepository } from './infrastructure/repositories/in-memory-audit-event.repository';
import { AuditController } from './presentation/controllers/audit.controller';
import { AuditInterceptor } from './presentation/interceptors/audit.interceptor';
import { AuditService } from './application/services/audit.service';

@Module({
  imports: [ConfigModule, AuthorizationModule],
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_EVENT_REPOSITORY,
      useClass: InMemoryAuditEventRepository,
    },
    RecordAuditEventUseCase,
    ListAuditEventsUseCase,
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
