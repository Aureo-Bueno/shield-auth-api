import { ConfigService } from '@nestjs/config';
import { OAuth2BearerGuard } from '../oauth2-bearer.guard';
import { SecurityAuthService } from '../../security-auth.service';

describe('OAuth2BearerGuard', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'OAUTH2_ACCESS_TOKENS') {
        return 'oauth-token-1,oauth-token-2';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  const buildContext = (authorization: string | undefined) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authorization ? { authorization } : {},
        }),
      }),
    }) as any;

  it('allows request with valid oauth2 bearer token', () => {
    const service = new SecurityAuthService(configService);
    const guard = new OAuth2BearerGuard(service);

    expect(guard.canActivate(buildContext('Bearer oauth-token-1'))).toBe(true);
  });

  it('rejects request with invalid oauth2 bearer token', () => {
    const service = new SecurityAuthService(configService);
    const guard = new OAuth2BearerGuard(service);

    expect(() => guard.canActivate(buildContext('Bearer invalid-token'))).toThrow(
      'Invalid OAuth2 bearer token',
    );
  });

  it('rejects request with missing authorization header', () => {
    const service = new SecurityAuthService(configService);
    const guard = new OAuth2BearerGuard(service);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      'Invalid OAuth2 bearer token',
    );
  });

  it('rejects request with malformed authorization scheme', () => {
    const service = new SecurityAuthService(configService);
    const guard = new OAuth2BearerGuard(service);

    expect(() => guard.canActivate(buildContext('Basic abc123'))).toThrow(
      'Invalid OAuth2 bearer token',
    );
  });
});
