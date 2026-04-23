import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { AwsModule } from './aws/aws.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { InviteUserModule } from './invite-user/invite-user.module';
import { loggerConfig } from './observability/logger.config';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CsrfProtectionMiddleware } from './security/middlewares/csrf-protection.middleware';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    LoggerModule.forRoot(loggerConfig),
    AuditModule,
    AwsModule,
    UsersModule,
    AuthModule,
    InviteUserModule,
    IntegrationsModule,
    RateLimitModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfProtectionMiddleware).forRoutes('*');
  }
}
