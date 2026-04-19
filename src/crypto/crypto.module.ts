import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PasswordCryptoService } from './services/password-crypto.service';

@Module({
  imports: [ConfigModule],
  providers: [PasswordCryptoService],
  exports: [PasswordCryptoService],
})
export class CryptoModule {}
