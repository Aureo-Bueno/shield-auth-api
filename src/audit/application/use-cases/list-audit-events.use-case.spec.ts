import { ListAuditEventsUseCase } from './list-audit-events.use-case';

describe('ListAuditEventsUseCase', () => {
  it('enforces limit boundaries before listing', () => {
    const repository = {
      save: jest.fn(),
      list: jest.fn(() => [{ id: 1 }]),
    };
    const useCase = new ListAuditEventsUseCase(repository as any);

    useCase.execute(0);
    useCase.execute(999);
    useCase.execute(10);
    useCase.execute();

    expect(repository.list).toHaveBeenNthCalledWith(1, 1);
    expect(repository.list).toHaveBeenNthCalledWith(2, 200);
    expect(repository.list).toHaveBeenNthCalledWith(3, 10);
    expect(repository.list).toHaveBeenNthCalledWith(4, 50);
  });
});
