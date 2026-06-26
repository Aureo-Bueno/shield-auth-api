import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { initializeSentry } from './observability/sentry';
import {
  getMetrics,
  getMetricsContentType,
  initializeMetrics,
} from './observability/metrics';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService, { strict: false });
  initializeSentry(configService);

  if (configService.get<string>('METRICS_ENABLED') === 'true') {
    initializeMetrics();
  }

  app.useLogger(app.get(Logger));
  app.flushLogs();
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use((_: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const apiServerUrl =
    configService.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3000';

  const config = new DocumentBuilder()
    .setTitle('Shield Auth API')
    .setDescription(
      [
        'Shield Auth API provides authentication, authorization, invite flows, audit access, integration status, and health checks.',
        '',
        'Authentication modes:',
        'bearer for user sessions and authenticated account flows.',
        'apiKey for server-to-server integration status.',
        'oauth2 for integration status backed by OAuth2.',
        '',
        'The API is versioned under /v1. Use the Authorize button to persist credentials in Swagger UI.',
      ].join('\n'),
    )
    .setVersion('v1')
    .addServer(apiServerUrl, 'Primary API server')
    .addTag(
      'auth',
      'Authentication, token refresh, password reset, and account lifecycle.',
    )
    .addTag('users', 'Current user profile and user lookup endpoints.')
    .addTag(
      'integrations',
      'Integration health and access-controlled service status.',
    )
    .addTag(
      'invite-user',
      'Invite creation, validation, cancellation, and completion.',
    )
    .addTag('audit', 'Administrative access to audit events.')
    .addTag('health', 'Liveness and readiness probes used by orchestration.')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT bearer token',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for server-to-server integrations',
      },
      'apiKey',
    )
    .addOAuth2(
      {
        type: 'oauth2',
        flows: {
          clientCredentials: {
            tokenUrl:
              configService.get<string>('OAUTH2_TOKEN_URL') ??
              'http://localhost:3000/oauth/token',
            scopes: {
              'read:integrations': 'Read integration status',
            },
          },
          authorizationCode: {
            authorizationUrl:
              configService.get<string>('OAUTH2_AUTH_URL') ??
              'http://localhost:3000/oauth/authorize',
            tokenUrl:
              configService.get<string>('OAUTH2_TOKEN_URL') ??
              'http://localhost:3000/oauth/token',
            scopes: {
              'read:integrations': 'Read integration status',
            },
          },
        },
      },
      'oauth2',
    )
    .addGlobalResponse(
      { status: 429, description: 'Too Many Requests' },
      { status: 500, description: 'Internal Server Error' },
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Shield Auth API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
    },
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/metrics', async (_req, res) => {
    (res as import('express').Response).setHeader(
      'Content-Type',
      getMetricsContentType(),
    );
    (res as import('express').Response).send(await getMetrics());
  });

  await app.listen(3000);
}

void bootstrap();
