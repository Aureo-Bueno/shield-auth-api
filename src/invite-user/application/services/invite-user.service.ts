import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import InviteUser from '../../entities/invite-user.entity';
import { UsersService } from '../../../users/application/services/users.service';
import { AwsSesService } from '../../../aws/services/aws-ses.service';
import { PasswordCryptoService } from '../../../crypto/services/password-crypto.service';

type InviteResult = {
  id: number;
  emailInvited: string;
  expires: Date;
  active: boolean;
};

type CompleteInviteResult = {
  message: string;
  email: string;
};

type ValidateInviteResult = {
  valid: true;
  emailInvited: string;
  expires: Date;
  active: boolean;
};

type SimpleMessage = {
  message: string;
};

@Injectable()
export class InviteUserService {
  private invites: InviteUser[] = [];
  private readonly inviteRegisterUrl: string;
  private readonly inviteExpiresHours: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly awsSesService: AwsSesService,
    private readonly configService: ConfigService,
    private readonly passwordCryptoService: PasswordCryptoService,
  ) {
    const inviteRegisterUrl = this.configService.get<string>(
      'INVITE_REGISTER_URL',
    );
    if (!inviteRegisterUrl) {
      throw new Error('INVITE_REGISTER_URL is not set');
    }

    const inviteExpiresHoursRaw =
      this.configService.get<string>('INVITE_EXPIRES_HOURS') ?? '24';
    const inviteExpiresHours = Number(inviteExpiresHoursRaw);
    if (
      !Number.isFinite(inviteExpiresHours) ||
      inviteExpiresHours <= 0 ||
      !Number.isInteger(inviteExpiresHours)
    ) {
      throw new Error('INVITE_EXPIRES_HOURS must be a positive integer');
    }

    this.inviteRegisterUrl = inviteRegisterUrl;
    this.inviteExpiresHours = inviteExpiresHours;
  }

  async invite(email: string): Promise<InviteResult> {
    const normalizedEmail = this.normalizeEmail(email);

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email already exists in the system');
    }

    return this.createInviteAndSend(normalizedEmail);
  }

  async resendInvite(email: string): Promise<InviteResult> {
    const normalizedEmail = this.normalizeEmail(email);

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email already exists in the system');
    }

    const hasInviteForEmail = this.invites.some(
      (item: InviteUser) => item.emailInvited === normalizedEmail,
    );
    if (!hasInviteForEmail) {
      throw new BadRequestException('Invite not found for email');
    }

    return this.createInviteAndSend(normalizedEmail);
  }

  validateInvite(email: string, token: string): ValidateInviteResult {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedToken = token.trim();
    const invite = this.getInviteByEmailAndToken(normalizedEmail, trimmedToken);

    if (!invite) {
      throw new BadRequestException('Invalid invite token');
    }

    if (!invite.active) {
      throw new BadRequestException('Invite is no longer active');
    }

    if (invite.expires.getTime() <= Date.now()) {
      invite.active = false;
      invite.updatedAt = new Date();
      throw new BadRequestException('Invite has expired');
    }

    return {
      valid: true,
      emailInvited: invite.emailInvited,
      expires: invite.expires,
      active: invite.active,
    };
  }

  cancelInvite(email: string, token: string): SimpleMessage {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedToken = token.trim();
    const invite = this.getInviteByEmailAndToken(normalizedEmail, trimmedToken);

    if (!invite) {
      throw new BadRequestException('Invalid invite token');
    }

    if (!invite.active) {
      return { message: 'Invite already inactive' };
    }

    invite.active = false;
    invite.updatedAt = new Date();

    return { message: 'Invite canceled successfully' };
  }

  async completeSignUp(
    email: string,
    password: string,
    token: string,
  ): Promise<CompleteInviteResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedToken = token.trim();
    const now = new Date();

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email already exists in the system');
    }

    const invite = this.getInviteByEmailAndToken(normalizedEmail, trimmedToken);

    if (!invite) {
      throw new BadRequestException('Invalid invite token');
    }

    if (!invite.active) {
      throw new BadRequestException('Invite is no longer active');
    }

    if (invite.expires.getTime() <= now.getTime()) {
      invite.active = false;
      invite.updatedAt = now;
      throw new BadRequestException('Invite has expired');
    }

    const hashedPassword =
      await this.passwordCryptoService.hashPassword(password);
    await this.usersService.create({
      name: this.deriveNameFromEmail(normalizedEmail),
      email: normalizedEmail,
      password: hashedPassword,
    });

    invite.active = false;
    invite.updatedAt = now;

    return {
      message: 'User registered successfully',
      email: normalizedEmail,
    };
  }

  private deactivateActiveInvitesForEmail(email: string): void {
    const now = new Date();
    this.invites.forEach((invite: InviteUser) => {
      if (invite.emailInvited === email && invite.active) {
        invite.active = false;
        invite.updatedAt = now;
      }
    });
  }

  private deriveNameFromEmail(email: string): string {
    const localPart = email.split('@')[0]?.trim();
    return localPart && localPart.length > 0 ? localPart : 'user';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getInviteByEmailAndToken(
    normalizedEmail: string,
    trimmedToken: string,
  ): InviteUser | undefined {
    return this.invites.find(
      (item: InviteUser) =>
        item.emailInvited === normalizedEmail && item.token === trimmedToken,
    );
  }

  private async createInviteAndSend(email: string): Promise<InviteResult> {
    this.deactivateActiveInvitesForEmail(email);

    const now = new Date();
    const invite = new InviteUser({
      id:
        this.invites.length === 0
          ? 0
          : this.invites[this.invites.length - 1].id + 1,
      emailInvited: email,
      createdAt: now,
      updatedAt: now,
      expires: new Date(
        now.getTime() + this.inviteExpiresHours * 60 * 60 * 1000,
      ),
      token: randomBytes(32).toString('hex'),
      active: true,
    });

    this.invites.push(invite);

    await this.awsSesService.sendEmail({
      to: email,
      subject: 'Invite para cadastro',
      textBody: this.buildInviteTextBody(invite),
      htmlBody: this.buildInviteHtmlBody(invite),
    });

    return {
      id: invite.id,
      emailInvited: invite.emailInvited,
      expires: invite.expires,
      active: invite.active,
    };
  }

  private buildInviteUrl(invite: InviteUser): string {
    const separator = this.inviteRegisterUrl.includes('?') ? '&' : '?';
    return `${this.inviteRegisterUrl}${separator}token=${invite.token}&email=${encodeURIComponent(invite.emailInvited)}`;
  }

  private buildInviteTextBody(invite: InviteUser): string {
    const inviteUrl = this.buildInviteUrl(invite);
    return [
      'Voce foi convidado para se cadastrar no sistema.',
      `Link de cadastro: ${inviteUrl}`,
      `Expira em: ${invite.expires.toISOString()}`,
    ].join('\n');
  }

  private buildInviteHtmlBody(invite: InviteUser): string {
    const inviteUrl = this.buildInviteUrl(invite);
    return [
      '<p>Voce foi convidado para se cadastrar no sistema.</p>',
      `<p><a href="${inviteUrl}">Clique aqui para concluir o cadastro</a></p>`,
      `<p>Expira em: ${invite.expires.toISOString()}</p>`,
    ].join('');
  }
}
