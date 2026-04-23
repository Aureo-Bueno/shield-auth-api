import { ConfigService } from '@nestjs/config';
import { ApiKeyOrOAuth2Guard } from '../api-key-or-oauth2.guard';
import { SecurityAuthService } from '../../security-auth.service';

describe('ApiKeyOrOAuth2Guard', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'API_KEYS') {
        return 'service-api-key';
      }
      if (key === 'OAUTH2_ACCESS_TOKENS') {
        return 'service-oauth-token';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  const buildContext = (
    apiKey: string | undefined,
    authorization: string | undefined,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
            ...(authorization ? { authorization } : {}),
          },
        }),
      }),
    }) as any;

  it('allows valid API key', () => {
    const service = new SecurityAuthService(configService);
    const guard = new ApiKeyOrOAuth2Guard(service);

    expect(guard.canActivate(buildContext('service-api-key', undefined))).toBe(
      true,
    );
  });

  it('allows valid OAuth2 bearer token', () => {
    const service = new SecurityAuthService(configService);
    const guard = new ApiKeyOrOAuth2Guard(service);

    expect(
      guard.canActivate(buildContext(undefined, 'Bearer service-oauth-token')),
    ).toBe(true);
  });

  it('rejects when neither API key nor OAuth2 token is valid', () => {
    const service = new SecurityAuthService(configService);
    const guard = new ApiKeyOrOAuth2Guard(service);

    expect(() =>
      guard.canActivate(buildContext('bad-key', 'Bearer bad-token')),
    ).toThrow('Invalid API key or OAuth2 bearer token');
  });

  it('rejects malformed authorization scheme when api key is absent', () => {
    const service = new SecurityAuthService(configService);
    const guard = new ApiKeyOrOAuth2Guard(service);

    expect(() => guard.canActivate(buildContext(undefined, 'Basic token'))).toThrow(
      'Invalid API key or OAuth2 bearer token',
    );
  });
});
