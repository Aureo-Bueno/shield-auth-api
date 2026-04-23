import { AuditService } from './audit.service';
import { ListAuditEventsUseCase } from './application/use-cases/list-audit-events.use-case';
import { RecordAuditEventUseCase } from './application/use-cases/record-audit-event.use-case';

type RecordAuditEventUseCaseMock = {
  execute: jest.Mock;
};

type ListAuditEventsUseCaseMock = {
  execute: jest.Mock;
};

describe('AuditService', () => {
  const recordAuditEventUseCase: RecordAuditEventUseCaseMock = {
    execute: jest.fn(),
  };
  const listAuditEventsUseCase: ListAuditEventsUseCaseMock = {
    execute: jest.fn(),
  };
  let service: AuditService;

  beforeEach(() => {
    recordAuditEventUseCase.execute.mockReset();
    listAuditEventsUseCase.execute.mockReset();
    service = new AuditService(
      recordAuditEventUseCase as unknown as RecordAuditEventUseCase,
      listAuditEventsUseCase as unknown as ListAuditEventsUseCase,
    );
  });

  it('record delegates to record use case', () => {
    recordAuditEventUseCase.execute.mockReturnValue({ id: 11 });

    const result = service.record({
      method: 'POST',
      path: '/v1/auth/login',
      statusCode: 201,
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      durationMs: 12,
    });

    expect(recordAuditEventUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 11 });
  });

  it('list delegates to list use case', () => {
    listAuditEventsUseCase.execute.mockReturnValue([{ id: 1 }]);

    const result = service.list(30);

    expect(listAuditEventsUseCase.execute).toHaveBeenCalledWith(30);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('list uses default limit when omitted', () => {
    listAuditEventsUseCase.execute.mockReturnValue([]);

    service.list();

    expect(listAuditEventsUseCase.execute).toHaveBeenCalledWith(50);
  });
});
