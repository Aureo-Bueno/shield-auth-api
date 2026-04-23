import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { InviteUserService } from '../services/invite-user.service';
import { UsersService } from '../../users/services/users.service';
import { AwsSesService } from '../../aws/services/aws-ses.service';
import { PasswordCryptoService } from '../../crypto/services/password-crypto.service';

type UsersServiceMock = {
  findByEmail: jest.Mock;
  create: jest.Mock;
};

type AwsSesServiceMock = {
  sendEmail: jest.Mock;
};

type PasswordCryptoServiceMock = {
  hashPassword: jest.Mock;
};

describe('InviteUserService', () => {
  let service: InviteUserService;

  const configValues = {
    INVITE_REGISTER_URL: 'http://localhost:5173/sign-up',
    INVITE_EXPIRES_HOURS: '24',
  } as const;

  const usersService: UsersServiceMock = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const awsSesService: AwsSesServiceMock = {
    sendEmail: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: keyof typeof configValues) => configValues[key]),
  };
  const passwordCryptoService: PasswordCryptoServiceMock = {
    hashPassword: jest.fn(async (password: string) => `$argon2id$${password}`),
  };

  beforeEach(() => {
    usersService.findByEmail.mockReset();
    usersService.create.mockReset();
    awsSesService.sendEmail.mockReset();
    configService.get.mockClear();
    passwordCryptoService.hashPassword.mockClear();

    service = new InviteUserService(
      usersService as unknown as UsersService,
      awsSesService as unknown as AwsSesService,
      configService as unknown as ConfigService,
      passwordCryptoService as unknown as PasswordCryptoService,
    );
  });

  it('invite throws conflict when email already exists', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 1,
      name: 'Existing',
      email: 'existing@example.com',
      password: 'hash',
    });

    await expect(service.invite('existing@example.com')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(awsSesService.sendEmail).not.toHaveBeenCalled();
  });

  it('invite sends email and completeSignUp creates user with hashed password', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);
    usersService.create.mockImplementation(async (input) => ({
      id: 10,
      ...input,
    }));
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    const inviteResult = await service.invite('new-user@example.com');

    expect(inviteResult).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        emailInvited: 'new-user@example.com',
        active: true,
      }),
    );
    expect(awsSesService.sendEmail).toHaveBeenCalledTimes(1);
    expect(awsSesService.sendEmail.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: 'new-user@example.com',
        subject: expect.any(String),
      }),
    );

    const inviteEmailPayload = awsSesService.sendEmail.mock.calls[0][0];
    const linkMatch = String(inviteEmailPayload.textBody).match(
      /token=([a-f0-9]+)/,
    );
    expect(linkMatch).toBeTruthy();
    const token = linkMatch?.[1];
    if (!token) {
      throw new Error('Token not found in invite email body');
    }

    const completeResult = await service.completeSignUp(
      'new-user@example.com',
      'secret1234',
      token,
    );

    expect(completeResult).toEqual(
      expect.objectContaining({
        message: 'User registered successfully',
        email: 'new-user@example.com',
      }),
    );
    expect(usersService.create).toHaveBeenCalledTimes(1);
    const createInput = usersService.create.mock.calls[0][0];
    expect(createInput).toEqual(
      expect.objectContaining({
        name: 'new-user',
        email: 'new-user@example.com',
      }),
    );
    expect(passwordCryptoService.hashPassword).toHaveBeenCalledWith(
      'secret1234',
    );
    expect(createInput.password).toBe('$argon2id$secret1234');

    await expect(
      service.completeSignUp('new-user@example.com', 'secret1234', token),
    ).rejects.toThrow('Invite is no longer active');
  });

  it('validateInvite returns valid for active invite', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    await service.invite('valid-user@example.com');
    const payload = awsSesService.sendEmail.mock.calls[0][0];
    const match = String(payload.textBody).match(/token=([a-f0-9]+)/);
    expect(match).toBeTruthy();
    const token = match?.[1];
    if (!token) {
      throw new Error('Token not found in invite email body');
    }

    const result = service.validateInvite('valid-user@example.com', token);

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        emailInvited: 'valid-user@example.com',
        active: true,
      }),
    );
  });

  it('resendInvite creates a new invite token', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    await service.invite('resend-user@example.com');
    const firstPayload = awsSesService.sendEmail.mock.calls[0][0];
    const firstTokenMatch = String(firstPayload.textBody).match(
      /token=([a-f0-9]+)/,
    );
    expect(firstTokenMatch).toBeTruthy();
    const firstToken = firstTokenMatch?.[1];
    if (!firstToken) {
      throw new Error('First token not found');
    }

    const resent = await service.resendInvite('resend-user@example.com');
    expect(resent).toEqual(
      expect.objectContaining({
        emailInvited: 'resend-user@example.com',
        active: true,
      }),
    );

    const secondPayload = awsSesService.sendEmail.mock.calls[1][0];
    const secondTokenMatch = String(secondPayload.textBody).match(
      /token=([a-f0-9]+)/,
    );
    expect(secondTokenMatch).toBeTruthy();
    const secondToken = secondTokenMatch?.[1];
    if (!secondToken) {
      throw new Error('Second token not found');
    }

    expect(secondToken).not.toBe(firstToken);
    expect(() =>
      service.validateInvite('resend-user@example.com', firstToken),
    ).toThrow('Invite is no longer active');
  });

  it('cancelInvite deactivates an invite token', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    await service.invite('cancel-user@example.com');
    const payload = awsSesService.sendEmail.mock.calls[0][0];
    const match = String(payload.textBody).match(/token=([a-f0-9]+)/);
    expect(match).toBeTruthy();
    const token = match?.[1];
    if (!token) {
      throw new Error('Token not found in invite email body');
    }

    const cancelResult = service.cancelInvite('cancel-user@example.com', token);
    expect(cancelResult).toEqual({
      message: 'Invite canceled successfully',
    });

    expect(() => service.validateInvite('cancel-user@example.com', token)).toThrow(
      'Invite is no longer active',
    );
  });

  it('completeSignUp throws invalid token when invite is missing', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);

    await expect(
      service.completeSignUp('missing@example.com', 'secret1234', 'bad-token'),
    ).rejects.toThrow('Invalid invite token');
  });

  it('completeSignUp throws when user already exists', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 7,
      name: 'Existing',
      email: 'existing@example.com',
      password: 'hash',
    });

    await expect(
      service.completeSignUp('existing@example.com', 'secret1234', 'token'),
    ).rejects.toThrow('Email already exists in the system');
  });

  it('completeSignUp throws expired token when invite is expired', async () => {
    usersService.findByEmail.mockResolvedValue(undefined);
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    await service.invite('expired-user@example.com');
    const payload = awsSesService.sendEmail.mock.calls[0][0];
    const match = String(payload.textBody).match(/token=([a-f0-9]+)/);
    expect(match).toBeTruthy();
    const token = match?.[1];
    if (!token) {
      throw new Error('Token not found in invite email body');
    }

    const invite = (service as any).invites[0];
    invite.expires = new Date(Date.now() - 60_000);

    await expect(
      service.completeSignUp('expired-user@example.com', 'secret1234', token),
    ).rejects.toThrow('Invite has expired');
    expect(invite.active).toBe(false);
  });

  it('uses default INVITE_EXPIRES_HOURS when config is not provided', async () => {
    const configWithoutExpires = {
      get: jest.fn((key: string) => {
        if (key === 'INVITE_REGISTER_URL') {
          return configValues.INVITE_REGISTER_URL;
        }
        return undefined;
      }),
    };
    const serviceWithDefault = new InviteUserService(
      usersService as unknown as UsersService,
      awsSesService as unknown as AwsSesService,
      configWithoutExpires as unknown as ConfigService,
      passwordCryptoService as unknown as PasswordCryptoService,
    );

    usersService.findByEmail.mockResolvedValue(undefined);
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });

    const result = await serviceWithDefault.invite('default-exp@example.com');

    expect(result).toEqual(
      expect.objectContaining({
        emailInvited: 'default-exp@example.com',
      }),
    );
  });

  it('constructor throws for missing INVITE_REGISTER_URL and invalid INVITE_EXPIRES_HOURS', () => {
    const missingUrlConfig = {
      get: jest.fn(() => undefined),
    };
    expect(
      () =>
        new InviteUserService(
          usersService as unknown as UsersService,
          awsSesService as unknown as AwsSesService,
          missingUrlConfig as unknown as ConfigService,
          passwordCryptoService as unknown as PasswordCryptoService,
        ),
    ).toThrow('INVITE_REGISTER_URL is not set');

    const invalidHoursConfig = {
      get: jest.fn((key: string) => {
        if (key === 'INVITE_REGISTER_URL') {
          return 'http://localhost:5173/sign-up';
        }
        if (key === 'INVITE_EXPIRES_HOURS') {
          return '0';
        }
        return undefined;
      }),
    };

    expect(
      () =>
        new InviteUserService(
          usersService as unknown as UsersService,
          awsSesService as unknown as AwsSesService,
          invalidHoursConfig as unknown as ConfigService,
          passwordCryptoService as unknown as PasswordCryptoService,
        ),
    ).toThrow('INVITE_EXPIRES_HOURS must be a positive integer');
  });

  it('resendInvite throws for existing user and missing prior invite', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 1,
      name: 'Existing',
      email: 'existing@example.com',
      password: 'hash',
    });

    await expect(service.resendInvite('existing@example.com')).rejects.toThrow(
      'Email already exists in the system',
    );

    usersService.findByEmail.mockResolvedValue(undefined);

    await expect(service.resendInvite('new@example.com')).rejects.toThrow(
      'Invite not found for email',
    );
  });

  it('validateInvite throws for invalid and expired invites', async () => {
    expect(() => service.validateInvite('none@example.com', 'token')).toThrow(
      'Invalid invite token',
    );

    usersService.findByEmail.mockResolvedValue(undefined);
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });
    await service.invite('expired-validate@example.com');
    const payload = awsSesService.sendEmail.mock.calls[0][0];
    const token = String(payload.textBody).match(/token=([a-f0-9]+)/)?.[1];
    if (!token) {
      throw new Error('Token not found');
    }

    const invite = (service as any).invites[0];
    invite.expires = new Date(Date.now() - 1_000);

    expect(() =>
      service.validateInvite('expired-validate@example.com', token),
    ).toThrow('Invite has expired');
    expect(invite.active).toBe(false);
  });

  it('cancelInvite throws for invalid token and handles already inactive invite', async () => {
    expect(() => service.cancelInvite('none@example.com', 'token')).toThrow(
      'Invalid invite token',
    );

    usersService.findByEmail.mockResolvedValue(undefined);
    awsSesService.sendEmail.mockResolvedValue({ MessageId: 'message-id' });
    await service.invite('inactive-cancel@example.com');
    const payload = awsSesService.sendEmail.mock.calls[0][0];
    const token = String(payload.textBody).match(/token=([a-f0-9]+)/)?.[1];
    if (!token) {
      throw new Error('Token not found');
    }

    const first = service.cancelInvite('inactive-cancel@example.com', token);
    const second = service.cancelInvite('inactive-cancel@example.com', token);

    expect(first).toEqual({ message: 'Invite canceled successfully' });
    expect(second).toEqual({ message: 'Invite already inactive' });
  });
});
