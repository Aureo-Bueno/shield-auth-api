import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.ACCESS_SECRET = 'test-access-secret';
    process.env.REFRESH_SECRET = 'test-refresh-secret';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /auth/login returns tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
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
      .post('/auth/login')
      .send({ email: 'aureo@gmail.com', password: 'aureopass' })
      .expect(201);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(201);

    expect(refreshResponse.text || refreshResponse.body).toBeTruthy();
  });

  it('DELETE /auth/logout revokes the refresh token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'aureo@gmail.com', password: 'aureopass' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/auth/logout')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(200);
  });
});
