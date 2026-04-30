jest.mock('@opentelemetry/api', () => {
  const context = {
    active: jest.fn(() => 'context'),
  };
  const trace = {
    getSpan: jest.fn(() => null),
  };

  return { context, trace };
});

import { ConfigService } from '@nestjs/config';
import { createLoggerConfig } from './logger.config';

describe('logger.config', () => {
  const otelModule = jest.requireMock('@opentelemetry/api') as {
    trace: { getSpan: jest.Mock };
  };
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
    otelModule.trace.getSpan.mockReset();
    otelModule.trace.getSpan.mockReturnValue(null);
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

  it('injects trace identifiers when span is active', () => {
    otelModule.trace.getSpan.mockReturnValue({
      spanContext: () => ({
        traceId: 'trace-1',
        spanId: 'span-1',
      }),
    });

    const props = createLoggerConfig(
      configService as unknown as ConfigService,
    ).pinoHttp?.customProps?.();

    expect(props).toEqual(
      expect.objectContaining({
        service: 'shield-auth-api',
        trace_id: 'trace-1',
        span_id: 'span-1',
      }),
    );
  });

  it('keeps trace identifiers undefined when no active span exists', () => {
    otelModule.trace.getSpan.mockReturnValue(null);

    const props = createLoggerConfig(
      configService as unknown as ConfigService,
    ).pinoHttp?.customProps?.();

    expect(props).toEqual(
      expect.objectContaining({
        service: 'shield-auth-api',
        trace_id: undefined,
        span_id: undefined,
      }),
    );
  });
});
