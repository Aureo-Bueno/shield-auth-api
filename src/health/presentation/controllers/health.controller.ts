import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  HttpHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { EventLoopHealthIndicator } from '../../infrastructure/indicators/event-loop.health-indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly eventLoop: EventLoopHealthIndicator,
    private readonly http: HttpHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Reports whether the API process is running and ready to receive traffic.',
  })
  @ApiOkResponse({ description: 'Service is alive and responding.' })
  liveness(): {
    status: 'ok';
    service: string;
    uptimeSeconds: number;
    timestamp: string;
  } {
    return {
      status: 'ok',
      service: this.configService.get<string>('OTEL_SERVICE_NAME') ?? 'shield-auth-api',
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Runs memory, disk, event loop, and optional dependency checks to determine whether the service should receive traffic.',
  })
  @ApiOkResponse({
    description: 'All readiness checks passed.',
  })
  readiness() {
    const checks: HealthIndicatorFunction[] = [
      () =>
        this.memory.checkHeap(
          'memory_heap',
          Number(
            this.configService.get<string>('HEALTH_MAX_HEAP_BYTES') ??
              300 * 1024 * 1024,
          ),
        ),
      () =>
        this.memory.checkRSS(
          'memory_rss',
          Number(
            this.configService.get<string>('HEALTH_MAX_RSS_BYTES') ??
              500 * 1024 * 1024,
          ),
        ),
      () =>
        this.disk.checkStorage('disk', {
          path: this.configService.get<string>('HEALTH_DISK_PATH') ?? '/',
          thresholdPercent: Number(
            this.configService.get<string>('HEALTH_DISK_THRESHOLD_PERCENT') ??
              0.9,
          ),
        }),
      () =>
        this.eventLoop.isHealthy(
          'event_loop',
          Number(this.configService.get<string>('HEALTH_EVENT_LOOP_LAG_MS') ?? 200),
        ),
    ];

    const dependencyUrl = this.configService.get<string>('HEALTH_DEPENDENCY_URL');
    if (dependencyUrl) {
      checks.push(() => this.http.pingCheck('dependency', dependencyUrl));
    }

    return this.health.check(checks);
  }
}
