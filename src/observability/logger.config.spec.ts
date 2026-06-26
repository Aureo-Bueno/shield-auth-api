import { ConfigService } from '@nestjs/config';
import { createLoggerConfig } from './logger.config';

describe('logger.config', () => {
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | undefined> = {
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'shield-auth-api',
      };

      return values[key];
    }),
  };

  beforeEach(() => {
    configService.get.mockClear();
  });

  it('reuses x-request-id when present', () => {
    const request = { headers: { 'x-request-id': 'request-123' } } as any;

    const id = createLoggerConfig(
      configService as unknown as ConfigService,
    ).pinoHttp?.genReqId?.(request);

    expect(id).toBe('request-123');
  });

  it('generates a request id when header is absent', () => {
    const request = { headers: {} } as any;

    const id = createLoggerConfig(
      configService as unknown as ConfigService,
    ).pinoHttp?.genReqId?.(request);

    expect(typeof id).toBe('string');
    expect(String(id).length).toBeGreaterThan(0);
  });

  it('sets log levels based on status code/error', () => {
    const customLogLevel = createLoggerConfig(
      configService as unknown as ConfigService,
    ).pinoHttp?.customLogLevel;
    if (!customLogLevel) {
      throw new Error('customLogLevel not configured');
    }

    expect(customLogLevel({} as any, { statusCode: 200 } as any)).toBe('info');
    expect(customLogLevel({} as any, { statusCode: 404 } as any)).toBe('warn');
    expect(customLogLevel({} as any, { statusCode: 500 } as any)).toBe('error');
    expect(
      customLogLevel({} as any, { statusCode: 200 } as any, new Error('boom')),
    ).toBe('error');
  });

  it('includes service name in custom props', () => {
    const props = createLoggerConfig(
      configService as unknown as ConfigService,
    ).pinoHttp?.customProps?.();

    expect(props).toEqual(
      expect.objectContaining({
        service: 'shield-auth-api',
      }),
    );
  });
});
