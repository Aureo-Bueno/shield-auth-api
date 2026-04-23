import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityAuthService } from './application/services/security-auth.service';
import { ApiKeyGuard } from './presentation/guards/api-key.guard';
import { OAuth2BearerGuard } from './presentation/guards/oauth2-bearer.guard';
import { ApiKeyOrOAuth2Guard } from './presentation/guards/api-key-or-oauth2.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    SecurityAuthService,
    ApiKeyGuard,
    OAuth2BearerGuard,
    ApiKeyOrOAuth2Guard,
  ],
  exports: [
    SecurityAuthService,
    ApiKeyGuard,
    OAuth2BearerGuard,
    ApiKeyOrOAuth2Guard,
  ],
})
export class SecurityModule {}
