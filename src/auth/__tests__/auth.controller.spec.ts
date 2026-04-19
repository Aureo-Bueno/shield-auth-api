import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import RefreshTokenDto from '../dto/refresh-token.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

type AuthServiceMock = {
  signUp: jest.Mock;
  login: jest.Mock;
  refresh: jest.Mock;
  logout: jest.Mock;
  forgotPassword: jest.Mock;
  resetPassword: jest.Mock;
  changePassword: jest.Mock;
};

describe('AuthController', () => {
  let controller: AuthController;
  const authService: AuthServiceMock = {
    signUp: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(() => {
    authService.signUp.mockReset();
    authService.login.mockReset();
    authService.refresh.mockReset();
    authService.logout.mockReset();
    authService.forgotPassword.mockReset();
    authService.resetPassword.mockReset();
    authService.changePassword.mockReset();
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('signUp delegates to AuthService with request metadata', async () => {
    const body: SignUpDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'pass12345',
    };
    const request = { headers: { 'user-agent': 'jest' } };
    authService.signUp.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const result = await controller.signUp(request as any, '127.0.0.1', body);

    expect(authService.signUp).toHaveBeenCalledWith(
      'Test User',
      'test@example.com',
      'pass12345',
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    );
    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('login delegates to AuthService with request metadata', async () => {
    const body: LoginDto = { email: 'test@example.com', password: 'pass123' };
    const request = { headers: { 'user-agent': 'jest' } };
    authService.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const result = await controller.login(request as any, '127.0.0.1', body);

    expect(authService.login).toHaveBeenCalledWith(
      'test@example.com',
      'pass123',
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    );
    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('refreshToken delegates to AuthService', async () => {
    const body: RefreshTokenDto = {
      refreshToken: 'refresh-token',
    } as RefreshTokenDto;
    authService.refresh.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    const result = await controller.refreshToken(body);

    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('logout delegates to AuthService', async () => {
    const body: RefreshTokenDto = {
      refreshToken: 'refresh-token',
    } as RefreshTokenDto;
    authService.logout.mockResolvedValue(undefined);

    const result = await controller.logout(body);

    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(result).toBeUndefined();
  });

  it('forgotPassword delegates to AuthService', async () => {
    const body: ForgotPasswordDto = {
      email: 'user@example.com',
    };
    authService.forgotPassword.mockResolvedValue({
      message:
        'If the email exists, a password reset link has been sent successfully',
    });

    const result = await controller.forgotPassword(body);

    expect(authService.forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(result).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
  });

  it('resetPassword delegates to AuthService', async () => {
    const body: ResetPasswordDto = {
      email: 'user@example.com',
      token: 'token',
      password: 'newSecret123',
    };
    authService.resetPassword.mockResolvedValue({
      message: 'Password reset successfully',
    });

    const result = await controller.resetPassword(body);

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'user@example.com',
      'token',
      'newSecret123',
    );
    expect(result).toEqual({
      message: 'Password reset successfully',
    });
  });

  it('changePassword delegates to AuthService', async () => {
    const request = { user: { userId: 12 } };
    const body: ChangePasswordDto = {
      currentPassword: 'currentSecret123',
      newPassword: 'newSecret123',
    };
    authService.changePassword.mockResolvedValue({
      message: 'Password changed successfully',
    });

    const result = await controller.changePassword(request as any, body);

    expect(authService.changePassword).toHaveBeenCalledWith(
      12,
      'currentSecret123',
      'newSecret123',
    );
    expect(result).toEqual({
      message: 'Password changed successfully',
    });
  });
});
