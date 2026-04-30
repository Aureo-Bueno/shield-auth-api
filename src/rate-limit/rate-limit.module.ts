import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { verify } from 'jsonwebtoken';

const isAuthenticatedRequest = (
  request: Request,
  secret: string | undefined,
): boolean => {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return false;
  }

  const [scheme, token] = authorization.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return false;
  }

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
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('ACCESS_SECRET');

        return [
          {
            ttl: 60,
            limit: 20,
            skipIf: (context) => {
              const request = context.switchToHttp().getRequest<Request>();
              return (
                isAuthenticatedRequest(request, secret) ||
                isHealthCheckRequest(request)
              );
            },
          },
        ];
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
