import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { verify } from 'jsonwebtoken';

const isAuthenticatedRequest = (request: Request): boolean => {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return false;
  }

  const [scheme, token] = authorization.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return false;
  }

  const secret = process.env.ACCESS_SECRET;
  if (!secret) {
    return false;
  }

  try {
    verify(token, secret);
    return true;
  } catch {
    return false;
  }
};

const isHealthCheckRequest = (request: Request): boolean =>
  /^\/v\d+\/health\//.test(request.path) || request.path.startsWith('/health/');

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 20,
        skipIf: (context) => {
          const request = context.switchToHttp().getRequest<Request>();
          return (
            isAuthenticatedRequest(request) || isHealthCheckRequest(request)
          );
        },
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
