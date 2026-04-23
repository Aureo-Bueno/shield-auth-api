import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SecurityAuthService } from '../../application/services/security-auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly securityAuthService: SecurityAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];
    const apiKey = typeof apiKeyHeader === 'string' ? apiKeyHeader : undefined;

    if (!this.securityAuthService.isValidApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
