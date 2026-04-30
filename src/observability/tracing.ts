import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { ConfigService } from '@nestjs/config';

export const initializeTracing = (configService: ConfigService): void => {
  const isTracingEnabled = configService.get<string>('OTEL_ENABLED') === 'true';

  if (!isTracingEnabled) {
    return;
  }

  if (configService.get<string>('OTEL_LOG_LEVEL') === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const serviceName =
    configService.get<string>('OTEL_SERVICE_NAME') ?? 'shield-auth-api';
  const serviceVersion = configService.get<string>('SENTRY_RELEASE') ?? '0.0.1';
  const deploymentEnvironment =
    configService.get<string>('NODE_ENV') ?? 'development';
  const tracesEndpoint =
    configService.get<string>('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT') ??
    'http://localhost:4318/v1/traces';

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: deploymentEnvironment,
    }),
    traceExporter: new OTLPTraceExporter({
      url: tracesEndpoint,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  void sdk.start();

  const handleSignal = (signal: NodeJS.Signals): void => {
    void sdk
      .shutdown()
      .catch(() => {
        // no-op: tracing shutdown should not block process termination
      })
      .finally(() => {
        process.kill(process.pid, signal);
      });
  };

  process.once('SIGTERM', () => {
    handleSignal('SIGTERM');
  });

  process.once('SIGINT', () => {
    handleSignal('SIGINT');
  });
};
