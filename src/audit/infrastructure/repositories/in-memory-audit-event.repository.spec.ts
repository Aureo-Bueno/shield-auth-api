import { ConfigService } from '@nestjs/config';
import { InMemoryAuditEventRepository } from './in-memory-audit-event.repository';

describe('InMemoryAuditEventRepository', () => {
  it('throws when AUDIT_MAX_EVENTS is invalid', () => {
    const configService = {
      get: jest.fn((key: string) => (key === 'AUDIT_MAX_EVENTS' ? '0' : undefined)),
    } as unknown as ConfigService;

    expect(() => new InMemoryAuditEventRepository(configService)).toThrow(
      'AUDIT_MAX_EVENTS must be a positive integer',
    );
  });

  it('stores events and keeps max buffer size', () => {
    const configService = {
      get: jest.fn((key: string) => (key === 'AUDIT_MAX_EVENTS' ? '2' : undefined)),
    } as unknown as ConfigService;
    const repository = new InMemoryAuditEventRepository(configService);

    repository.save({
      method: 'POST',
      path: '/v1/a',
      statusCode: 201,
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      durationMs: 1,
    });
    repository.save({
      method: 'POST',
      path: '/v1/b',
      statusCode: 201,
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      durationMs: 1,
    });
    const latest = repository.save({
      method: 'POST',
      path: '/v1/c',
      statusCode: 201,
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      durationMs: 1,
    });

    const listed = repository.list(10);

    expect(latest).toEqual(
      expect.objectContaining({
        id: 2,
        path: '/v1/c',
      }),
    );
    expect(listed).toHaveLength(2);
    expect(listed[0].path).toBe('/v1/c');
    expect(listed[1].path).toBe('/v1/b');
  });

  it('uses default max events when config is absent', () => {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const repository = new InMemoryAuditEventRepository(configService);
    const saved = repository.save({
      method: 'POST',
      path: '/v1/default',
      statusCode: 201,
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      durationMs: 1,
    });

    expect(saved.id).toBe(0);
  });
});
