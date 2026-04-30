import { HealthController } from './health.controller';
import { EventLoopHealthIndicator } from './event-loop.health-indicator';
import { ConfigService } from '@nestjs/config';

describe('HealthController', () => {
  const health = {
    check: jest.fn(),
  };
  const memory = {
    checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
    checkRSS: jest.fn().mockResolvedValue({ memory_rss: { status: 'up' } }),
  };
  const disk = {
    checkStorage: jest.fn().mockResolvedValue({ disk: { status: 'up' } }),
  };
  const eventLoop = {
    isHealthy: jest.fn().mockResolvedValue({ event_loop: { status: 'up' } }),
  };
  const http = {
    pingCheck: jest.fn().mockResolvedValue({ dependency: { status: 'up' } }),
  };
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | undefined> = {
        OTEL_SERVICE_NAME: 'shield-auth-api',
        HEALTH_DEPENDENCY_URL: undefined,
        HEALTH_MAX_HEAP_BYTES: undefined,
        HEALTH_MAX_RSS_BYTES: undefined,
        HEALTH_DISK_PATH: undefined,
        HEALTH_DISK_THRESHOLD_PERCENT: undefined,
        HEALTH_EVENT_LOOP_LAG_MS: undefined,
      };

      return values[key];
    }),
  };

  let controller: HealthController;

  beforeEach(() => {
    health.check.mockReset();
    memory.checkHeap.mockClear();
    memory.checkRSS.mockClear();
    disk.checkStorage.mockClear();
    eventLoop.isHealthy.mockClear();
    http.pingCheck.mockClear();
    configService.get.mockClear();

    controller = new HealthController(
      health as any,
      memory as any,
      disk as any,
      eventLoop as unknown as EventLoopHealthIndicator,
      http as any,
      configService as unknown as ConfigService,
    );
  });

  it('returns liveness payload', () => {
    const result = controller.liveness();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'shield-auth-api',
        uptimeSeconds: expect.any(Number),
        timestamp: expect.any(String),
      }),
    );
  });

  it('readiness runs baseline checks without dependency url', async () => {
    health.check.mockImplementation(async (checks: Array<() => Promise<unknown>>) => {
      const results = await Promise.all(checks.map((check) => check()));
      return { results };
    });

    const result = await controller.readiness();

    expect(memory.checkHeap).toHaveBeenCalledTimes(1);
    expect(memory.checkRSS).toHaveBeenCalledTimes(1);
    expect(disk.checkStorage).toHaveBeenCalledTimes(1);
    expect(eventLoop.isHealthy).toHaveBeenCalledTimes(1);
    expect(http.pingCheck).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        results: expect.any(Array),
      }),
    );
  });

  it('readiness includes dependency ping when HEALTH_DEPENDENCY_URL is set', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'HEALTH_DEPENDENCY_URL') {
        return 'http://localhost:3001/health';
      }

      if (key === 'OTEL_SERVICE_NAME') {
        return 'shield-auth-api';
      }

      return undefined;
    });
    health.check.mockImplementation(async (checks: Array<() => Promise<unknown>>) => {
      await Promise.all(checks.map((check) => check()));
      return { ok: true };
    });

    const result = await controller.readiness();

    expect(http.pingCheck).toHaveBeenCalledWith(
      'dependency',
      'http://localhost:3001/health',
    );
    expect(result).toEqual({ ok: true });
  });
});
