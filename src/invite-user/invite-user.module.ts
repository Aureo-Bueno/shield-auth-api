import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsModule } from '../aws/aws.module';
import { CryptoModule } from '../crypto/crypto.module';
import { UsersModule } from '../users/users.module';
import { InviteUserController } from './controllers/invite-user.controller';
import { InviteUserService } from './services/invite-user.service';

@Module({
  imports: [ConfigModule, AwsModule, UsersModule, CryptoModule],
  controllers: [InviteUserController],
  providers: [InviteUserService],
  exports: [InviteUserService],
})
export class InviteUserModule {}
