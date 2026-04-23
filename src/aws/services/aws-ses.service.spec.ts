import { ConfigService } from '@nestjs/config';
import { AwsSesService } from './aws-ses.service';

jest.mock('@aws-sdk/client-ses', () => {
  const sendMock = jest.fn();
  const SESClient = jest.fn().mockImplementation(() => ({
    send: sendMock,
  }));
  const SendEmailCommand = jest
    .fn()
    .mockImplementation((input: unknown) => ({ input }));

  return {
    SESClient,
    SendEmailCommand,
    __sendMock: sendMock,
  };
});

type ConfigValues = {
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SES_ENDPOINT?: string;
  AWS_SES_FROM_EMAIL?: string;
};

const buildConfigService = (overrides?: ConfigValues): ConfigService => {
  const defaults: Required<ConfigValues> = {
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_SES_ENDPOINT: 'http://localhost:4566',
    AWS_SES_FROM_EMAIL: 'noreply@test.dev',
  };
  const values = { ...defaults, ...overrides };

  return {
    get: jest.fn((key: keyof ConfigValues) => values[key]),
  } as unknown as ConfigService;
};

describe('AwsSesService', () => {
  const awsModule = jest.requireMock('@aws-sdk/client-ses') as {
    SESClient: jest.Mock;
    SendEmailCommand: jest.Mock;
    __sendMock: jest.Mock;
  };

  beforeEach(() => {
    awsModule.SESClient.mockClear();
    awsModule.SendEmailCommand.mockClear();
    awsModule.__sendMock.mockReset();
    awsModule.__sendMock.mockResolvedValue({ MessageId: '1' });
  });

  it('throws when required constructor config is missing', () => {
    const configService = buildConfigService({ AWS_REGION: undefined });

    expect(() => new AwsSesService(configService)).toThrow('AWS_REGION is not set');
  });

  it('throws when destination recipients are empty', async () => {
    const service = new AwsSesService(buildConfigService());

    await expect(
      service.sendEmail({
        to: '   ',
        subject: 'hello',
        textBody: 'body',
      }),
    ).rejects.toThrow('At least one destination email is required');
  });

  it('throws when both textBody and htmlBody are missing', async () => {
    const service = new AwsSesService(buildConfigService());

    await expect(
      service.sendEmail({
        to: 'a@b.com',
        subject: 'hello',
      }),
    ).rejects.toThrow('Provide at least textBody or htmlBody');
  });

  it('throws when default from config is missing and payload.from is not provided', async () => {
    const service = new AwsSesService(
      buildConfigService({ AWS_SES_FROM_EMAIL: undefined }),
    );

    await expect(
      service.sendEmail({
        to: 'a@b.com',
        subject: 'hello',
        textBody: 'body',
      }),
    ).rejects.toThrow('AWS_SES_FROM_EMAIL is not set');
  });

  it('sends email using normalized recipients and default from', async () => {
    const service = new AwsSesService(buildConfigService({ AWS_SES_ENDPOINT: '' }));

    const result = await service.sendEmail({
      to: ['a@test.dev', '  ', 'b@test.dev'],
      subject: 'subject',
      textBody: 'text',
      htmlBody: '<p>html</p>',
      cc: ['cc@test.dev'],
      bcc: ['bcc@test.dev'],
      replyTo: ['reply@test.dev'],
    });

    expect(result).toEqual({ MessageId: '1' });
    expect(awsModule.SESClient).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: undefined,
        region: 'us-east-1',
      }),
    );
    expect(awsModule.SendEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Source: 'noreply@test.dev',
        Destination: {
          ToAddresses: ['a@test.dev', 'b@test.dev'],
          CcAddresses: ['cc@test.dev'],
          BccAddresses: ['bcc@test.dev'],
        },
        ReplyToAddresses: ['reply@test.dev'],
      }),
    );
    expect(awsModule.__sendMock).toHaveBeenCalledTimes(1);
  });

  it('uses explicit from and supports sendTextEmail/sendHtmlEmail', async () => {
    const service = new AwsSesService(buildConfigService());

    await service.sendTextEmail({
      to: 'text@test.dev',
      subject: 'text',
      textBody: 'hello',
      from: 'custom@test.dev',
    });
    await service.sendHtmlEmail({
      to: 'html@test.dev',
      subject: 'html',
      htmlBody: '<p>hi</p>',
      from: 'custom@test.dev',
    });

    expect(awsModule.SendEmailCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        Source: 'custom@test.dev',
        Message: expect.objectContaining({
          Body: expect.objectContaining({
            Text: { Data: 'hello', Charset: 'UTF-8' },
          }),
        }),
      }),
    );
    expect(awsModule.SendEmailCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        Source: 'custom@test.dev',
        Message: expect.objectContaining({
          Body: expect.objectContaining({
            Html: { Data: '<p>hi</p>', Charset: 'UTF-8' },
          }),
        }),
      }),
    );
  });
});
