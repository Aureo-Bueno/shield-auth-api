import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [UsersModule, AuthModule, ConfigModule.forRoot(), RateLimitModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
