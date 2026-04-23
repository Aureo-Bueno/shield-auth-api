import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { monitorEventLoopDelay } from 'node:perf_hooks';

@Injectable()
export class EventLoopHealthIndicator extends HealthIndicator {
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });

  constructor() {
    super();
    this.eventLoopDelay.enable();
  }

  isHealthy(key: string, maxLagMs: number): Promise<HealthIndicatorResult> {
    const meanNanoseconds = this.eventLoopDelay.mean;
    const lagMs = Number.isFinite(meanNanoseconds)
      ? meanNanoseconds / 1_000_000
      : 0;
    this.eventLoopDelay.reset();

    const isHealthy = lagMs < maxLagMs;
    const result = this.getStatus(key, isHealthy, {
      lagMs: Number(lagMs.toFixed(2)),
      thresholdMs: maxLagMs,
    });

    if (!isHealthy) {
      throw new HealthCheckError('Event loop lag is above threshold', result);
    }

    return Promise.resolve(result);
  }
}
