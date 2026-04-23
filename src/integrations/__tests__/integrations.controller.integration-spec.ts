import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '../../security/security.module';
import { IntegrationsController } from '../controllers/integrations.controller';

describe('IntegrationsController (integration)', () => {
  let controller: IntegrationsController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SecurityModule],
      controllers: [IntegrationsController],
    }).compile();

    controller = moduleRef.get(IntegrationsController);
  });

  it('status returns enterprise integration payload', () => {
    const result = controller.status();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        authMode: 'api_key_or_oauth2',
        timestamp: expect.any(String),
      }),
    );
  });
});
