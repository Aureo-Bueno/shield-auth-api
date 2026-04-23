import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const IGNORED_PATH_PREFIXES = ['/health/', '/docs'];

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(request: Request, _: Response, next: NextFunction): void {
    if (!this.isEnabled()) {
      next();
      return;
    }

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    if (
      IGNORED_PATH_PREFIXES.some((prefix) => request.path.startsWith(prefix)) ||
      /^\/v\d+\/health\//.test(request.path)
    ) {
      next();
      return;
    }

    const expectedToken = this.configService.get<string>('CSRF_TOKEN');
    if (!expectedToken) {
      next(
        new ForbiddenException(
          'CSRF protection enabled but CSRF_TOKEN is missing',
        ),
      );
      return;
    }

    const allowedOrigins = this.readAllowedOrigins();
    const origin = request.headers.origin;
    if (
      typeof origin === 'string' &&
      allowedOrigins.length > 0 &&
      !allowedOrigins.includes(origin)
    ) {
      next(new ForbiddenException('Untrusted request origin'));
      return;
    }

    const csrfTokenHeader = request.headers['x-csrf-token'];
    if (
      typeof csrfTokenHeader !== 'string' ||
      csrfTokenHeader !== expectedToken
    ) {
      next(new ForbiddenException('Invalid CSRF token'));
      return;
    }

    next();
  }

  private isEnabled(): boolean {
    return this.configService.get<string>('CSRF_ENABLED') === 'true';
  }

  private readAllowedOrigins(): string[] {
    const origins =
      this.configService.get<string>('CSRF_ALLOWED_ORIGINS') ?? '';
    return origins
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
}
