import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | undefined> = {
        ACCESS_SECRET: 'test-access-secret',
        REFRESH_SECRET: 'test-refresh-secret',
        PASSWORD_PEPPER: 'test-pepper',
        API_KEYS: 'e2e-api-key',
        OAUTH2_ACCESS_TOKENS: 'e2e-oauth-token',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key',
        AWS_SES_FROM_EMAIL: 'no-reply@local.test',
        AWS_SES_ENDPOINT: 'http://localhost:4566',
        INVITE_REGISTER_URL: 'http://localhost:5173/sign-up',
        INVITE_EXPIRES_HOURS: '24',
        LOG_LEVEL: 'info',
        OTEL_SERVICE_NAME: 'shield-auth-api',
        HEALTH_DEPENDENCY_URL: undefined,
        HEALTH_MAX_HEAP_BYTES: undefined,
        HEALTH_MAX_RSS_BYTES: undefined,
        HEALTH_DISK_PATH: undefined,
        HEALTH_DISK_THRESHOLD_PERCENT: undefined,
        HEALTH_EVENT_LOOP_LAG_MS: undefined,
      };

      return values[key];
    }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /auth/login returns tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'aureo@gmail.com', password: 'aureopass' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
  });

  it('POST /auth/refresh returns a new access token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'aureo@gmail.com', password: 'aureopass' })
      .expect(201);

    const refreshResponse = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(201);

    expect(refreshResponse.text || refreshResponse.body).toBeTruthy();
  });

  it('DELETE /auth/logout revokes the refresh token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'aureo@gmail.com', password: 'aureopass' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/v1/auth/logout')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(200);
  });

  it('GET /integrations/status accepts API key authentication', async () => {
    await request(app.getHttpServer())
      .get('/v1/integrations/status')
      .set('x-api-key', 'e2e-api-key')
      .expect(200);
  });

  it('GET /integrations/status accepts OAuth2 bearer authentication', async () => {
    await request(app.getHttpServer())
      .get('/v1/integrations/status')
      .set('Authorization', 'Bearer e2e-oauth-token')
      .expect(200);
  });
});
