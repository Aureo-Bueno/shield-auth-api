import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';

describe('UsersController (integration)', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    }).compile();

    controller = moduleRef.get(UsersController);
  });

  it('me returns the current user profile', async () => {
    const request = { user: { userId: 0 } };

    const result = await controller.me(request as any);

    expect(result).toEqual(
      expect.objectContaining({
        id: 0,
        email: 'aureo@gmail.com',
      }),
    );
  });
});
