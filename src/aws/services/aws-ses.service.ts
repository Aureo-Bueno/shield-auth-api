import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandOutput,
} from '@aws-sdk/client-ses';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RecipientInput = string | string[];

export type SendEmailInput = {
  to: RecipientInput;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
};

type SendTextEmailInput = {
  to: RecipientInput;
  subject: string;
  textBody: string;
  from?: string;
};

type SendHtmlEmailInput = {
  to: RecipientInput;
  subject: string;
  htmlBody: string;
  from?: string;
};

@Injectable()
export class AwsSesService {
  private readonly sesClient: SESClient;

  constructor(private readonly configService: ConfigService) {
    this.sesClient = this.createSesClient();
  }

  async sendEmail(payload: SendEmailInput): Promise<SendEmailCommandOutput> {
    const toAddresses = this.normalizeRecipients(payload.to);
    if (toAddresses.length === 0) {
      throw new Error('At least one destination email is required');
    }

    if (!payload.textBody && !payload.htmlBody) {
      throw new Error('Provide at least textBody or htmlBody');
    }

    const source = payload.from ?? this.getRequiredConfig('AWS_SES_FROM_EMAIL');

    const body: {
      Text?: {
        Data: string;
        Charset: string;
      };
      Html?: {
        Data: string;
        Charset: string;
      };
    } = {};

    if (payload.textBody) {
      body.Text = { Data: payload.textBody, Charset: 'UTF-8' };
    }

    if (payload.htmlBody) {
      body.Html = { Data: payload.htmlBody, Charset: 'UTF-8' };
    }

    return this.sesClient.send(
      new SendEmailCommand({
        Source: source,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: payload.cc,
          BccAddresses: payload.bcc,
        },
        ReplyToAddresses: payload.replyTo,
        Message: {
          Subject: {
            Data: payload.subject,
            Charset: 'UTF-8',
          },
          Body: body,
        },
      }),
    );
  }

  async sendTextEmail(
    payload: SendTextEmailInput,
  ): Promise<SendEmailCommandOutput> {
    return this.sendEmail(payload);
  }

  async sendHtmlEmail(
    payload: SendHtmlEmailInput,
  ): Promise<SendEmailCommandOutput> {
    return this.sendEmail(payload);
  }

  private createSesClient(): SESClient {
    const region = this.getRequiredConfig('AWS_REGION');
    const accessKeyId = this.getRequiredConfig('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.getRequiredConfig('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('AWS_SES_ENDPOINT');

    return new SESClient({
      region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`${key} is not set`);
    }
    return value;
  }

  private normalizeRecipients(value: RecipientInput): string[] {
    if (Array.isArray(value)) {
      return value.filter((item) => item.trim().length > 0);
    }
    const email = value.trim();
    return email.length > 0 ? [email] : [];
  }
}
