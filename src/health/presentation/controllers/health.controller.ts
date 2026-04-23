import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  HttpHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { EventLoopHealthIndicator } from '../../infrastructure/indicators/event-loop.health-indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly eventLoop: EventLoopHealthIndicator,
    private readonly http: HttpHealthIndicator,
  ) {}

  @Get('live')
  liveness(): {
    status: 'ok';
    service: string;
    uptimeSeconds: number;
    timestamp: string;
  } {
    return {
      status: 'ok',
      service: process.env.OTEL_SERVICE_NAME ?? 'shield-auth-api',
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    const checks: HealthIndicatorFunction[] = [
      () =>
        this.memory.checkHeap(
          'memory_heap',
          Number(process.env.HEALTH_MAX_HEAP_BYTES ?? 300 * 1024 * 1024),
        ),
      () =>
        this.memory.checkRSS(
          'memory_rss',
          Number(process.env.HEALTH_MAX_RSS_BYTES ?? 500 * 1024 * 1024),
        ),
      () =>
        this.disk.checkStorage('disk', {
          path: process.env.HEALTH_DISK_PATH ?? '/',
          thresholdPercent: Number(
            process.env.HEALTH_DISK_THRESHOLD_PERCENT ?? 0.9,
          ),
        }),
      () =>
        this.eventLoop.isHealthy(
          'event_loop',
          Number(process.env.HEALTH_EVENT_LOOP_LAG_MS ?? 200),
        ),
    ];

    const dependencyUrl = process.env.HEALTH_DEPENDENCY_URL;
    if (dependencyUrl) {
      checks.push(() => this.http.pingCheck('dependency', dependencyUrl));
    }

    return this.health.check(checks);
  }
}
