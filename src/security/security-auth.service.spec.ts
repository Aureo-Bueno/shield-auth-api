import { ConfigService } from '@nestjs/config';
import { SecurityAuthService } from './security-auth.service';

describe('SecurityAuthService', () => {
  it('validates api keys and oauth2 tokens from config', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'API_KEYS') {
          return 'key-a,key-b';
        }
        if (key === 'OAUTH2_ACCESS_TOKENS') {
          return 'token-a,token-b';
        }
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new SecurityAuthService(configService);

    expect(service.isValidApiKey('key-a')).toBe(true);
    expect(service.isValidApiKey(' key-b ')).toBe(true);
    expect(service.isValidApiKey('missing')).toBe(false);

    expect(service.isValidOAuth2Token('token-a')).toBe(true);
    expect(service.isValidOAuth2Token(' token-b ')).toBe(true);
    expect(service.isValidOAuth2Token('missing')).toBe(false);
  });

  it('returns false when configured lists are empty', () => {
    const configService = {
      get: jest.fn(() => ''),
    } as unknown as ConfigService;
    const service = new SecurityAuthService(configService);

    expect(service.isValidApiKey('anything')).toBe(false);
    expect(service.isValidApiKey(undefined)).toBe(false);
    expect(service.isValidOAuth2Token('anything')).toBe(false);
    expect(service.isValidOAuth2Token(undefined)).toBe(false);
  });
});
