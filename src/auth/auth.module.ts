import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { UsersModule } from '../users/users.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AwsModule } from '../aws/aws.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [ConfigModule, UsersModule, CryptoModule, AwsModule],
})
export class AuthModule {}
