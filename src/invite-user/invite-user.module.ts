import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthorizationModule } from '../auth/authorization/authorization.module';
import { AwsModule } from '../aws/aws.module';
import { CryptoModule } from '../crypto/crypto.module';
import { UsersModule } from '../users/users.module';
import { InviteUserController } from './presentation/controllers/invite-user.controller';
import { InviteUserService } from './application/services/invite-user.service';

@Module({
  imports: [
    ConfigModule,
    AwsModule,
    UsersModule,
    CryptoModule,
    AuthorizationModule,
  ],
  controllers: [InviteUserController],
  providers: [InviteUserService],
  exports: [InviteUserService],
})
export class InviteUserModule {}
