import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from '../api-key.guard';
import { SecurityAuthService } from '../../security-auth.service';

describe('ApiKeyGuard', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'API_KEYS') {
        return 'key-1,key-2';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  const buildContext = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as any;

  it('allows request with valid api key', () => {
    const service = new SecurityAuthService(configService);
    const guard = new ApiKeyGuard(service);

    expect(guard.canActivate(buildContext({ 'x-api-key': 'key-1' }))).toBe(
      true,
    );
  });

  it('rejects request with invalid api key', () => {
    const service = new SecurityAuthService(configService);
    const guard = new ApiKeyGuard(service);

    expect(() =>
      guard.canActivate(buildContext({ 'x-api-key': 'invalid' })),
    ).toThrow('Invalid API key');
  });

  it('rejects request when api key header is missing', () => {
    const service = new SecurityAuthService(configService);
    const guard = new ApiKeyGuard(service);

    expect(() => guard.canActivate(buildContext({}))).toThrow('Invalid API key');
  });
});
