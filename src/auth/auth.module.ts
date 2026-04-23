import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthService } from './application/services/auth.service';
import { UsersModule } from '../users/users.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AwsModule } from '../aws/aws.module';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { AuthorizationModule } from './authorization/authorization.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  imports: [
    ConfigModule,
    PassportModule,
    UsersModule,
    CryptoModule,
    AwsModule,
    AuthorizationModule,
  ],
  exports: [AuthorizationModule],
})
export class AuthModule {}
