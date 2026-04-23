import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { EventLoopHealthIndicator } from './infrastructure/indicators/event-loop.health-indicator';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [EventLoopHealthIndicator],
})
export class HealthModule {}
