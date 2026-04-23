import './observability/tracing';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
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

  const config = new DocumentBuilder()
    .setTitle('NestJS JWT Auth')
    .setDescription('API documentation')
    .setVersion('v1')
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
              process.env.OAUTH2_TOKEN_URL ??
              'http://localhost:3000/oauth/token',
            scopes: {
              'read:integrations': 'Read integration status',
            },
          },
          authorizationCode: {
            authorizationUrl:
              process.env.OAUTH2_AUTH_URL ??
              'http://localhost:3000/oauth/authorize',
            tokenUrl:
              process.env.OAUTH2_TOKEN_URL ??
              'http://localhost:3000/oauth/token',
            scopes: {
              'read:integrations': 'Read integration status',
            },
          },
        },
      },
      'oauth2',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(3000);
}

void bootstrap();
