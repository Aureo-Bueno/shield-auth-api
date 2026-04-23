import { IntegrationsController } from './integrations.controller';

describe('IntegrationsController', () => {
  it('returns integration status payload', () => {
    const controller = new IntegrationsController();

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
