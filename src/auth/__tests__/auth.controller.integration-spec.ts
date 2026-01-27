import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/services/users.service';

describe('AuthController (integration)', () => {
  let controller: AuthController;

  beforeAll(() => {
    process.env.ACCESS_SECRET = 'test-access-secret';
    process.env.REFRESH_SECRET = 'test-refresh-secret';
  });

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, UsersService],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('login returns tokens for a valid user', async () => {
    const request = { headers: { 'user-agent': 'jest' } };

    const result = await controller.login(request as any, '127.0.0.1', {
      email: 'aureo@gmail.com',
      password: 'aureopass',
    });

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
  });

  it('refresh returns a new access token', async () => {
    const request = { headers: { 'user-agent': 'jest' } };
    const loginResult = await controller.login(request as any, '127.0.0.1', {
      email: 'aureo@gmail.com',
      password: 'aureopass',
    });
    expect(loginResult).toBeDefined();
    if (!loginResult) {
      throw new Error('Login failed in test setup');
    }

    const accessToken = await controller.refreshToken({
      refreshToken: loginResult.refreshToken,
    });

    expect(accessToken).toEqual(expect.any(String));
  });

  it('logout invalidates the refresh token', async () => {
    const request = { headers: { 'user-agent': 'jest' } };
    const loginResult = await controller.login(request as any, '127.0.0.1', {
      email: 'aureo@gmail.com',
      password: 'aureopass',
    });
    expect(loginResult).toBeDefined();
    if (!loginResult) {
      throw new Error('Login failed in test setup');
    }

    await controller.logout({ refreshToken: loginResult.refreshToken });
    const accessToken = await controller.refreshToken({
      refreshToken: loginResult.refreshToken,
    });

    expect(accessToken).toBeUndefined();
  });
});
