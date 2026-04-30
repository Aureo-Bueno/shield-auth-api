import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit.module';
import { AuditService } from '../audit.service';

describe('AuditModule (integration)', () => {
  let auditService: AuditService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuditModule],
    }).compile();

    auditService = moduleRef.get(AuditService);
  });

  it('records and lists audit events through clean architecture layers', () => {
    auditService.record({
      method: 'POST',
      path: '/v1/auth/login',
      statusCode: 201,
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      durationMs: 18,
    });

    const events = auditService.list(10);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/v1/auth/login',
        statusCode: 201,
      }),
    );
  });
});
