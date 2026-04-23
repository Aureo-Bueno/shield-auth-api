import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

type AuditServiceMock = {
  list: jest.Mock;
};

describe('AuditController', () => {
  let controller: AuditController;
  const auditService: AuditServiceMock = {
    list: jest.fn(),
  };

  beforeEach(() => {
    auditService.list.mockReset();
    controller = new AuditController(auditService as unknown as AuditService);
  });

  it('listEvents delegates to audit service', () => {
    auditService.list.mockReturnValue([{ id: 1 }]);

    const result = controller.listEvents(25);

    expect(auditService.list).toHaveBeenCalledWith(25);
    expect(result).toEqual([{ id: 1 }]);
  });
});
