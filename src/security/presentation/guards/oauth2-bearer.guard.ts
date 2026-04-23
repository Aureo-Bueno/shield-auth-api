import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SecurityAuthService } from '../../application/services/security-auth.service';

@Injectable()
export class OAuth2BearerGuard implements CanActivate {
  constructor(private readonly securityAuthService: SecurityAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!this.securityAuthService.isValidOAuth2Token(token)) {
      throw new UnauthorizedException('Invalid OAuth2 bearer token');
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
