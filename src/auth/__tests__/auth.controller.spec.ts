import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import RefreshTokenDto from '../dto/refresh-token.dto';

type AuthServiceMock = {
  login: jest.Mock;
  refresh: jest.Mock;
  logout: jest.Mock;
};

describe('AuthController', () => {
  let controller: AuthController;
  const authService: AuthServiceMock = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(() => {
    authService.login.mockReset();
    authService.refresh.mockReset();
    authService.logout.mockReset();
    controller = new AuthController(authService as unknown as AuthService);
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
    authService.refresh.mockResolvedValue('new-access-token');

    const result = await controller.refreshToken(body);

    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    expect(result).toBe('new-access-token');
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
});
