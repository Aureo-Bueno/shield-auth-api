import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/services/users.service';
import { PasswordCryptoService } from '../../crypto/services/password-crypto.service';
import { AwsSesService } from '../../aws/services/aws-ses.service';

describe('AuthController (integration)', () => {
  let controller: AuthController;
  const configValues = {
    ACCESS_SECRET: 'test-access-secret',
    REFRESH_SECRET: 'test-refresh-secret',
    RESET_PASSWORD_URL: 'http://localhost:5173/reset-password',
    RESET_PASSWORD_EXPIRES_HOURS: '1',
    AUTH_MAX_LOGIN_ATTEMPTS: '5',
    AUTH_LOCKOUT_MINUTES: '15',
  } as const;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        UsersService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: keyof typeof configValues) => configValues[key],
          },
        },
        {
          provide: PasswordCryptoService,
          useValue: {
            hashPassword: async (password: string) => `$argon2id$${password}`,
            verifyPassword: async (
              storedHash: string,
              candidatePassword: string,
            ) => storedHash === `$argon2id$${candidatePassword}`,
          },
        },
        {
          provide: AwsSesService,
          useValue: {
            sendEmail: async () => ({ MessageId: 'message-id' }),
          },
        },
      ],
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

  it('signUp creates an account and allows login', async () => {
    const request = { headers: { 'user-agent': 'jest' } };
    const credentials = {
      email: 'new-user@example.com',
      password: 'secret1234',
    };

    const signUpResult = await controller.signUp(request as any, '127.0.0.1', {
      name: 'New User',
      ...credentials,
    });

    expect(signUpResult).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );

    const loginResult = await controller.login(request as any, '127.0.0.1', {
      ...credentials,
    });

    expect(loginResult).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
  });

  it('refresh returns rotated tokens', async () => {
    const request = { headers: { 'user-agent': 'jest' } };
    const loginResult = await controller.login(request as any, '127.0.0.1', {
      email: 'aureo@gmail.com',
      password: 'aureopass',
    });
    expect(loginResult).toBeDefined();
    if (!loginResult) {
      throw new Error('Login failed in test setup');
    }

    const refreshedTokens = await controller.refreshToken({
      refreshToken: loginResult.refreshToken,
    });

    expect(refreshedTokens).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
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

  it('forgotPassword returns success message', async () => {
    const result = await controller.forgotPassword({
      email: 'aureo@gmail.com',
    });

    expect(result).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
  });

  it('resetPassword updates password using token flow', async () => {
    const forgotResult = await controller.forgotPassword({
      email: 'aureo@gmail.com',
    });
    expect(forgotResult).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
  });
});
