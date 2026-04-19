import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsModule } from './aws/aws.module';
import { AuthModule } from './auth/auth.module';
import { InviteUserModule } from './invite-user/invite-user.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AwsModule,
    UsersModule,
    AuthModule,
    InviteUserModule,
    RateLimitModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
