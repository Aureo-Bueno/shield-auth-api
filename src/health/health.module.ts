import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { EventLoopHealthIndicator } from './infrastructure/indicators/event-loop.health-indicator';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [ConfigModule, TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [EventLoopHealthIndicator],
})
export class HealthModule {}
