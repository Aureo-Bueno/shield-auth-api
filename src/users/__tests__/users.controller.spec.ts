import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';

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
});
