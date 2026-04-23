import { RecordAuditEventUseCase } from '../record-audit-event.use-case';

describe('RecordAuditEventUseCase', () => {
  it('persists audit event using repository port', () => {
    const repository = {
      save: jest.fn((input) => ({
        id: 1,
        timestamp: '2026-04-22T00:00:00.000Z',
        ...input,
      })),
      list: jest.fn(),
    };
    const useCase = new RecordAuditEventUseCase(repository as any);

    const result = useCase.execute({
      method: 'POST',
      path: '/v1/auth/login',
      statusCode: 201,
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      durationMs: 12,
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/v1/auth/login',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        method: 'POST',
      }),
    );
  });
});
