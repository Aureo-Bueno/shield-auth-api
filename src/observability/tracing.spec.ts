import { ConfigService } from '@nestjs/config';

type TracingTestSetup = {
  handlers: Record<string, () => void>;
  killSpy: jest.SpyInstance;
  onceSpy: jest.SpyInstance;
  diagSetLogger: jest.Mock;
  NodeSDKMock: jest.Mock;
  sdkStart: jest.Mock;
  sdkShutdown: jest.Mock;
  getNodeAutoInstrumentationsMock: jest.Mock;
  resourceFromAttributesMock: jest.Mock;
  OTLPTraceExporterMock: jest.Mock;
};

const setupTracingInit = (
  values: Record<string, string | undefined>,
  shutdownReject = false,
): TracingTestSetup => {
  jest.resetModules();

  const handlers: Record<string, () => void> = {};
  const killSpy = jest
    .spyOn(process, 'kill')
    .mockImplementation((() => true) as any);
  const onceSpy = jest
    .spyOn(process, 'once')
    .mockImplementation(((event: string, handler: () => void) => {
      handlers[event] = handler;
      return process;
    }) as any);

  const diagSetLogger = jest.fn();
  const getNodeAutoInstrumentationsMock = jest.fn(() => ['instrumentation']);
  const resourceFromAttributesMock = jest.fn((attributes) => attributes);
  const OTLPTraceExporterMock = jest.fn((options) => ({ options }));
  const sdkStart = jest.fn();
  const sdkShutdown = shutdownReject
    ? jest.fn().mockRejectedValue(new Error('shutdown error'))
    : jest.fn().mockResolvedValue(undefined);
  const NodeSDKMock = jest.fn(() => ({
    start: sdkStart,
    shutdown: sdkShutdown,
  }));

  jest.doMock('@opentelemetry/api', () => ({
    diag: {
      setLogger: diagSetLogger,
    },
    DiagConsoleLogger: jest.fn(),
    DiagLogLevel: {
      DEBUG: 'DEBUG',
    },
  }));
  jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
    getNodeAutoInstrumentations: getNodeAutoInstrumentationsMock,
  }));
  jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
    OTLPTraceExporter: OTLPTraceExporterMock,
  }));
  jest.doMock('@opentelemetry/resources', () => ({
    resourceFromAttributes: resourceFromAttributesMock,
  }));
  jest.doMock('@opentelemetry/sdk-node', () => ({
    NodeSDK: NodeSDKMock,
  }));
  jest.doMock('@opentelemetry/semantic-conventions', () => ({
    SEMRESATTRS_DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
    SEMRESATTRS_SERVICE_NAME: 'service.name',
    SEMRESATTRS_SERVICE_VERSION: 'service.version',
  }));

  const configService = {
    get: jest.fn((key: string) => values[key]),
  };

  jest.isolateModules(() => {
    const { initializeTracing } = require('./tracing');
    initializeTracing(configService as unknown as ConfigService);
  });

  return {
    handlers,
    killSpy,
    onceSpy,
    diagSetLogger,
    NodeSDKMock,
    sdkStart,
    sdkShutdown,
    getNodeAutoInstrumentationsMock,
    resourceFromAttributesMock,
    OTLPTraceExporterMock,
  };
};

describe('tracing bootstrap', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('does not initialize tracing when OTEL_ENABLED is false', () => {
    const setup = setupTracingInit({
      OTEL_ENABLED: 'false',
      OTEL_LOG_LEVEL: 'info',
    });

    expect(setup.NodeSDKMock).not.toHaveBeenCalled();
    expect(setup.diagSetLogger).not.toHaveBeenCalled();
    expect(setup.onceSpy).not.toHaveBeenCalled();
  });

  it('initializes tracing, starts sdk and handles SIGTERM/SIGINT', async () => {
    const setup = setupTracingInit({
      OTEL_ENABLED: 'true',
      OTEL_LOG_LEVEL: 'debug',
      OTEL_SERVICE_NAME: 'svc',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://otel:4318/v1/traces',
      NODE_ENV: 'test',
      SENTRY_RELEASE: '1.2.3',
    });

    expect(setup.diagSetLogger).toHaveBeenCalledTimes(1);
    expect(setup.resourceFromAttributesMock).toHaveBeenCalledWith({
      'service.name': 'svc',
      'service.version': '1.2.3',
      'deployment.environment': 'test',
    });
    expect(setup.OTLPTraceExporterMock).toHaveBeenCalledWith({
      url: 'http://otel:4318/v1/traces',
    });
    expect(setup.getNodeAutoInstrumentationsMock).toHaveBeenCalledWith({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    });
    expect(setup.NodeSDKMock).toHaveBeenCalledTimes(1);
    expect(setup.sdkStart).toHaveBeenCalledTimes(1);
    expect(setup.onceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(setup.onceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    setup.handlers.SIGTERM();
    setup.handlers.SIGINT();
    await Promise.resolve();
    await Promise.resolve();

    expect(setup.sdkShutdown).toHaveBeenCalledTimes(2);
    expect(setup.killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    expect(setup.killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
  });

  it('still kills process when sdk shutdown fails', async () => {
    const setup = setupTracingInit(
      {
        OTEL_ENABLED: 'true',
      },
      true,
    );

    setup.handlers.SIGTERM();
    await Promise.resolve();
    await Promise.resolve();

    expect(setup.sdkShutdown).toHaveBeenCalledTimes(1);
    expect(setup.killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
  });
});
