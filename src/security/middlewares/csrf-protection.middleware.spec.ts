import { ConfigService } from '@nestjs/config';
import { CsrfProtectionMiddleware } from './csrf-protection.middleware';

type ConfigValues = {
  CSRF_ENABLED?: string;
  CSRF_TOKEN?: string;
  CSRF_ALLOWED_ORIGINS?: string;
};

const buildConfigService = (values: ConfigValues): ConfigService =>
  ({
    get: jest.fn((key: keyof ConfigValues) => values[key]),
  }) as unknown as ConfigService;

describe('CsrfProtectionMiddleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    next.mockReset();
  });

  it('bypasses when csrf is disabled', () => {
    const middleware = new CsrfProtectionMiddleware(
      buildConfigService({ CSRF_ENABLED: 'false' }),
    );

    middleware.use({ method: 'POST', path: '/v1/auth/login', headers: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('bypasses safe methods', () => {
    const middleware = new CsrfProtectionMiddleware(
      buildConfigService({ CSRF_ENABLED: 'true' }),
    );

    middleware.use({ method: 'GET', path: '/v1/users/me', headers: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('bypasses ignored health paths', () => {
    const middleware = new CsrfProtectionMiddleware(
      buildConfigService({ CSRF_ENABLED: 'true' }),
    );

    middleware.use({ method: 'POST', path: '/health/live', headers: {} } as any, {} as any, next);
    middleware.use({ method: 'POST', path: '/v1/health/live', headers: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  it('rejects when csrf token config is missing', () => {
    const middleware = new CsrfProtectionMiddleware(
      buildConfigService({
        CSRF_ENABLED: 'true',
        CSRF_TOKEN: '',
      }),
    );

    middleware.use({ method: 'POST', path: '/v1/auth/login', headers: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'CSRF protection enabled but CSRF_TOKEN is missing',
      }),
    );
  });

  it('rejects untrusted origin when allowlist is set', () => {
    const middleware = new CsrfProtectionMiddleware(
      buildConfigService({
        CSRF_ENABLED: 'true',
        CSRF_TOKEN: 'token',
        CSRF_ALLOWED_ORIGINS: 'http://trusted.dev',
      }),
    );

    middleware.use(
      {
        method: 'POST',
        path: '/v1/auth/login',
        headers: { origin: 'http://evil.dev', 'x-csrf-token': 'token' },
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Untrusted request origin',
      }),
    );
  });

  it('rejects invalid csrf header token', () => {
    const middleware = new CsrfProtectionMiddleware(
      buildConfigService({
        CSRF_ENABLED: 'true',
        CSRF_TOKEN: 'token',
        CSRF_ALLOWED_ORIGINS: '',
      }),
    );

    middleware.use(
      {
        method: 'POST',
        path: '/v1/auth/login',
        headers: { origin: 'http://trusted.dev', 'x-csrf-token': 'wrong' },
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid CSRF token',
      }),
    );
  });

  it('allows valid csrf token and allowed origin', () => {
    const middleware = new CsrfProtectionMiddleware(
      buildConfigService({
        CSRF_ENABLED: 'true',
        CSRF_TOKEN: 'token',
        CSRF_ALLOWED_ORIGINS: 'http://trusted.dev,http://also-trusted.dev',
      }),
    );

    middleware.use(
      {
        method: 'POST',
        path: '/v1/auth/login',
        headers: { origin: 'http://trusted.dev', 'x-csrf-token': 'token' },
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });
});
