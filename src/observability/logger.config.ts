import { context, trace } from '@opentelemetry/api';
import { ConfigService } from '@nestjs/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import pino from 'pino';

const SENSITIVE_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.confirmPassword',
  'req.body.token',
  'res.headers["set-cookie"]',
];

const getTraceContext = (): { traceId?: string; spanId?: string } => {
  const activeSpan = trace.getSpan(context.active());
  if (!activeSpan) {
    return {};
  }

  const { traceId, spanId } = activeSpan.spanContext();
  return { traceId, spanId };
};

export const createLoggerConfig = (
  configService: ConfigService,
): Params => ({
  pinoHttp: {
    level: configService.get<string>('LOG_LEVEL') ?? 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    genReqId: (request: IncomingMessage) => {
      const requestId = request.headers['x-request-id'];
      if (typeof requestId === 'string' && requestId.length > 0) {
        return requestId;
      }

      return randomUUID();
    },
    customLogLevel: (
      _: IncomingMessage,
      response: ServerResponse,
      error?: Error,
    ) => {
      if (error || response.statusCode >= 500) {
        return 'error';
      }

      if (response.statusCode >= 400) {
        return 'warn';
      }

      return 'info';
    },
    customProps: () => {
      const { traceId, spanId } = getTraceContext();

      return {
        service:
          configService.get<string>('OTEL_SERVICE_NAME') ?? 'shield-auth-api',
        trace_id: traceId,
        span_id: spanId,
      };
    },
    redact: {
      paths: SENSITIVE_REDACT_PATHS,
      censor: '[REDACTED]',
    },
  },
});
