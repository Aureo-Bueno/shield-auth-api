import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { POLICIES_KEY, PolicyHandler } from '../../auth/authorization/policies.decorator';

type UsersServiceMock = {
  findOne: jest.Mock;
};

describe('UsersController', () => {
  let controller: UsersController;
  const usersService: UsersServiceMock = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    usersService.findOne.mockReset();
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('me returns the current user profile', async () => {
    const request = { user: { userId: 1 } };
    usersService.findOne.mockResolvedValue({
      id: 1,
      name: 'Test',
      email: 'test@example.com',
      password: 'pass123',
    });

    const result = await controller.me(request as any);

    expect(usersService.findOne).toHaveBeenCalledWith(1);
    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        email: 'test@example.com',
      }),
    );
  });

  it('findById delegates to service', async () => {
    usersService.findOne.mockResolvedValue({
      id: 2,
      name: 'Another',
      email: 'another@example.com',
      password: 'hash',
    });

    const result = await controller.findById(2);

    expect(usersService.findOne).toHaveBeenCalledWith(2);
    expect(result).toEqual(
      expect.objectContaining({
        id: 2,
        email: 'another@example.com',
      }),
    );
  });

  it('abac policy allows admin and self access paths', () => {
    const policyHandlers =
      Reflect.getMetadata(POLICIES_KEY, UsersController.prototype.findById) ?? [];
    const policy: PolicyHandler = policyHandlers[0];
    if (!policy) {
      throw new Error('Policy metadata not found');
    }

    const asAdmin = policy(
      { role: 'admin', userId: 99, permissions: [] } as any,
      { params: { id: '1' } } as any,
    );
    const asSelf = policy(
      { role: 'user', userId: 1, permissions: [] } as any,
      { params: { id: '1' } } as any,
    );
    const denied = policy(
      { role: 'user', userId: 10, permissions: [] } as any,
      { params: { id: '1' } } as any,
    );

    expect(asAdmin).toBe(true);
    expect(asSelf).toBe(true);
    expect(denied).toBe(false);
  });
});
