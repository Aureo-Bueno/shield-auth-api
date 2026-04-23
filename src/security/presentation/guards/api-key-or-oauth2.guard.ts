import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SecurityAuthService } from '../../application/services/security-auth.service';

@Injectable()
export class ApiKeyOrOAuth2Guard implements CanActivate {
  constructor(private readonly securityAuthService: SecurityAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];
    const apiKey = typeof apiKeyHeader === 'string' ? apiKeyHeader : undefined;
    const token = this.extractBearerToken(request);

    const isAuthorized =
      this.securityAuthService.isValidApiKey(apiKey) ||
      this.securityAuthService.isValidOAuth2Token(token);

    if (!isAuthorized) {
      throw new UnauthorizedException('Invalid API key or OAuth2 bearer token');
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
