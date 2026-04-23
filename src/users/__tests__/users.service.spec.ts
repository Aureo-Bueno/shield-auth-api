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

  it('updatePassword updates and returns the user', async () => {
    const updated = await service.updatePassword(1, '$argon2id$new');

    expect(updated).toEqual(
      expect.objectContaining({
        id: 1,
        password: '$argon2id$new',
      }),
    );
  });

  it('updatePassword returns undefined when user does not exist', async () => {
    const updated = await service.updatePassword(999, '$argon2id$new');

    expect(updated).toBeUndefined();
  });

  it('create assigns defaults for role and department', async () => {
    const created = await service.create({
      name: 'Created',
      email: 'created@example.com',
      password: '$argon2id$created',
    });

    expect(created).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        role: 'user',
        department: 'general',
      }),
    );
  });
});
