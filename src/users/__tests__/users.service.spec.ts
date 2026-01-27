import { UsersService } from '../services/users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  it('findByEmail returns a user when email exists', async () => {
    const user = await service.findByEmail('aureo@gmail.com');
    expect(user).toEqual(
      expect.objectContaining({
        id: 0,
        email: 'aureo@gmail.com',
      }),
    );
  });

  it('findByEmail returns undefined for unknown email', async () => {
    const user = await service.findByEmail('missing@example.com');
    expect(user).toBeUndefined();
  });

  it('findOne returns a user by id', async () => {
    const user = await service.findOne(1);
    expect(user).toEqual(
      expect.objectContaining({
        id: 1,
        email: 'bueno@gmail.com',
      }),
    );
  });
});
