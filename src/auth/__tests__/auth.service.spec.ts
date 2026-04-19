import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/services/users.service';
import { User } from '../../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { PasswordCryptoService } from '../../crypto/services/password-crypto.service';
import { AwsSesService } from '../../aws/services/aws-ses.service';

type UsersServiceMock = {
  findByEmail: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  updatePassword: jest.Mock;
};

type PasswordCryptoServiceMock = {
  hashPassword: jest.Mock;
  verifyPassword: jest.Mock;
};

type AwsSesServiceMock = {
  sendEmail: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  const configValues = {
    ACCESS_SECRET: 'test-access-secret',
    REFRESH_SECRET: 'test-refresh-secret',
    RESET_PASSWORD_URL: 'http://localhost:5173/reset-password',
    RESET_PASSWORD_EXPIRES_HOURS: '1',
    AUTH_MAX_LOGIN_ATTEMPTS: '2',
    AUTH_LOCKOUT_MINUTES: '1',
  } as const;

  const usersService: UsersServiceMock = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updatePassword: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: keyof typeof configValues) => configValues[key]),
  };
  const passwordCryptoService: PasswordCryptoServiceMock = {
    hashPassword: jest.fn(async (password: string) => `$argon2id$${password}`),
    verifyPassword: jest.fn(
      async (storedHash: string, candidatePassword: string) =>
        storedHash === `$argon2id$${candidatePassword}`,
    ),
  };
  const awsSesService: AwsSesServiceMock = {
    sendEmail: jest.fn(),
  };

  const user: User = {
    id: 42,
    name: 'Test',
    email: 'test@example.com',
    password: 'pass123',
  };

  const loginValues = { userAgent: 'jest', ipAddress: '127.0.0.1' };

  beforeAll(() => {
    process.env.REFRESH_SECRET = configValues.REFRESH_SECRET;
  });

  beforeEach(() => {
    usersService.findByEmail.mockReset();
    usersService.findOne.mockReset();
    usersService.create.mockReset();
    usersService.updatePassword.mockReset();
    configService.get.mockClear();
    passwordCryptoService.hashPassword.mockClear();
    passwordCryptoService.verifyPassword.mockClear();
    awsSesService.sendEmail.mockReset();
    service = new AuthService(
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
      passwordCryptoService as unknown as PasswordCryptoService,
      awsSesService as unknown as AwsSesService,
    );
  });

  it('signUp creates a new user with argon2id hash and returns tokens', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);
    usersService.create.mockImplementation(async (input) => ({
      id: 99,
      ...input,
    }));

    const result = await service.signUp(
      'New User',
      'new@example.com',
      'secret123',
      loginValues,
    );

    expect(usersService.create).toHaveBeenCalledTimes(1);
    const createArg = usersService.create.mock.calls[0][0];
    expect(createArg).toEqual(
      expect.objectContaining({
        name: 'New User',
        email: 'new@example.com',
      }),
    );
    expect(passwordCryptoService.hashPassword).toHaveBeenCalledWith('secret123');
    expect(createArg.password).toBe('$argon2id$secret123');
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
  });

  it('signUp throws when email already exists', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.signUp(user.name, user.email, 'another-pass', loginValues),
    ).rejects.toThrow('Email already in use');
    expect(usersService.create).not.toHaveBeenCalled();
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

  it('refresh rotates refresh token for valid refresh token', async () => {
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
    const refreshed = await service.refresh(loginResult.refreshToken);

    expect(refreshed).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
    expect(refreshed?.refreshToken).not.toBe(loginResult.refreshToken);
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

  it('locks login after max failed attempts by email/ip', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    await service.login(user.email, 'wrong-1', loginValues);
    await service.login(user.email, 'wrong-2', loginValues);

    await expect(
      service.login(user.email, user.password, loginValues),
    ).rejects.toThrow('Too many failed login attempts');
  });

  it('refresh invalidates previous refresh token for same device', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findOne.mockResolvedValue(user);

    const loginResult = await service.login(user.email, user.password, {
      ipAddress: '127.0.0.1',
      userAgent: 'device-a',
    });
    expect(loginResult).toBeDefined();
    if (!loginResult) {
      throw new Error('Login failed in test setup');
    }

    const firstRotation = await service.refresh(loginResult.refreshToken);
    expect(firstRotation).toBeDefined();
    if (!firstRotation) {
      throw new Error('First refresh failed in test setup');
    }

    const oldTokenResult = await service.refresh(loginResult.refreshToken);
    expect(oldTokenResult).toBeUndefined();

    const secondRotation = await service.refresh(firstRotation.refreshToken);
    expect(secondRotation).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
  });

  it('forgotPassword returns success message even when email does not exist', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);

    const result = await service.forgotPassword('missing@example.com');

    expect(result).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
    expect(awsSesService.sendEmail).not.toHaveBeenCalled();
  });

  it('forgotPassword sends email for existing user', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      email: 'test@example.com',
    });
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    const result = await service.forgotPassword('test@example.com');

    expect(result).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
    expect(awsSesService.sendEmail).toHaveBeenCalledTimes(1);
    const payload = awsSesService.sendEmail.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.any(String),
      }),
    );
    expect(String(payload.textBody)).toContain('token=');
  });

  it('resetPassword updates user password when token is valid', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      email: 'test@example.com',
    });
    usersService.updatePassword.mockResolvedValue({
      ...user,
      password: '$argon2id$newSecret123',
    });
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    await service.forgotPassword('test@example.com');
    const payload = awsSesService.sendEmail.mock.calls[0][0];
    const tokenMatch = String(payload.textBody).match(/token=([a-f0-9]+)/);
    expect(tokenMatch).toBeTruthy();
    const token = tokenMatch?.[1];
    if (!token) {
      throw new Error('Token not found in password reset body');
    }

    const result = await service.resetPassword(
      'test@example.com',
      token,
      'newSecret123',
    );

    expect(passwordCryptoService.hashPassword).toHaveBeenCalledWith(
      'newSecret123',
    );
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      user.id,
      '$argon2id$newSecret123',
    );
    expect(result).toEqual({
      message: 'Password reset successfully',
    });
  });

  it('changePassword verifies current and updates password', async () => {
    usersService.findOne.mockResolvedValue({
      ...user,
      password: '$argon2id$currentSecret123',
    });
    usersService.updatePassword.mockResolvedValue({
      ...user,
      password: '$argon2id$newSecret123',
    });

    const result = await service.changePassword(
      user.id,
      'currentSecret123',
      'newSecret123',
    );

    expect(passwordCryptoService.verifyPassword).toHaveBeenCalledWith(
      '$argon2id$currentSecret123',
      'currentSecret123',
    );
    expect(passwordCryptoService.hashPassword).toHaveBeenCalledWith(
      'newSecret123',
    );
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      user.id,
      '$argon2id$newSecret123',
    );
    expect(result).toEqual({
      message: 'Password changed successfully',
    });
  });
});
