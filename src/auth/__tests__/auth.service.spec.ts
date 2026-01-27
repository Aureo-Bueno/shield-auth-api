import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/services/users.service';
import { User } from '../../users/entities/user.entity';

type UsersServiceMock = {
  findByEmail: jest.Mock;
  findOne: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  const usersService: UsersServiceMock = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
  };

  const user: User = {
    id: 42,
    name: 'Test',
    email: 'test@example.com',
    password: 'pass123',
  };

  const loginValues = { userAgent: 'jest', ipAddress: '127.0.0.1' };

  beforeAll(() => {
    process.env.ACCESS_SECRET = 'test-access-secret';
    process.env.REFRESH_SECRET = 'test-refresh-secret';
  });

  beforeEach(() => {
    usersService.findByEmail.mockReset();
    usersService.findOne.mockReset();
    service = new AuthService(usersService as unknown as UsersService);
  });

  it('login returns tokens for valid user', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const result = await service.login(user.email, user.password, loginValues);

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
  });

  it('login returns undefined for unknown user', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);

    const result = await service.login(
      'missing@example.com',
      'pass',
      loginValues,
    );

    expect(result).toBeUndefined();
  });

  it('login returns undefined for wrong password', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const result = await service.login(user.email, 'wrong', loginValues);

    expect(result).toBeUndefined();
  });

  it('refresh returns new access token for valid refresh token', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findOne.mockResolvedValue(user);

    const loginResult = await service.login(
      user.email,
      user.password,
      loginValues,
    );
    expect(loginResult).toBeDefined();
    if (!loginResult) {
      throw new Error('Login failed in test setup');
    }
    const accessToken = await service.refresh(loginResult.refreshToken);

    expect(accessToken).toEqual(expect.any(String));
  });

  it('refresh returns undefined for invalid refresh token', async () => {
    const accessToken = await service.refresh('invalid-token');

    expect(accessToken).toBeUndefined();
  });

  it('logout invalidates the refresh token', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findOne.mockResolvedValue(user);

    const loginResult = await service.login(
      user.email,
      user.password,
      loginValues,
    );
    expect(loginResult).toBeDefined();
    if (!loginResult) {
      throw new Error('Login failed in test setup');
    }
    await service.logout(loginResult.refreshToken);
    const accessToken = await service.refresh(loginResult.refreshToken);

    expect(accessToken).toBeUndefined();
  });
});
