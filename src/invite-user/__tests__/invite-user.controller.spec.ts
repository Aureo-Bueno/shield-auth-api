import { InviteUserController } from '../controllers/invite-user.controller';
import { InviteUserService } from '../services/invite-user.service';

type InviteUserServiceMock = {
  invite: jest.Mock;
  resendInvite: jest.Mock;
  validateInvite: jest.Mock;
  cancelInvite: jest.Mock;
  completeSignUp: jest.Mock;
};

describe('InviteUserController', () => {
  let controller: InviteUserController;
  const inviteUserService: InviteUserServiceMock = {
    invite: jest.fn(),
    resendInvite: jest.fn(),
    validateInvite: jest.fn(),
    cancelInvite: jest.fn(),
    completeSignUp: jest.fn(),
  };

  beforeEach(() => {
    inviteUserService.invite.mockReset();
    inviteUserService.resendInvite.mockReset();
    inviteUserService.validateInvite.mockReset();
    inviteUserService.cancelInvite.mockReset();
    inviteUserService.completeSignUp.mockReset();
    controller = new InviteUserController(
      inviteUserService as unknown as InviteUserService,
    );
  });

  it('invite delegates to service', async () => {
    inviteUserService.invite.mockResolvedValue({
      id: 1,
      emailInvited: 'new-user@example.com',
      expires: new Date(),
      active: true,
    });

    const result = await controller.invite({ email: 'new-user@example.com' });

    expect(inviteUserService.invite).toHaveBeenCalledWith('new-user@example.com');
    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        emailInvited: 'new-user@example.com',
      }),
    );
  });

  it('completeSignUp delegates to service', async () => {
    inviteUserService.completeSignUp.mockResolvedValue({
      message: 'User registered successfully',
      email: 'new-user@example.com',
    });

    const result = await controller.completeSignUp({
      email: 'new-user@example.com',
      password: 'secret1234',
      token: 'token',
    });

    expect(inviteUserService.completeSignUp).toHaveBeenCalledWith(
      'new-user@example.com',
      'secret1234',
      'token',
    );
    expect(result).toEqual({
      message: 'User registered successfully',
      email: 'new-user@example.com',
    });
  });

  it('resend delegates to service', async () => {
    inviteUserService.resendInvite.mockResolvedValue({
      id: 2,
      emailInvited: 'new-user@example.com',
      expires: new Date(),
      active: true,
    });

    const result = await controller.resend({ email: 'new-user@example.com' });

    expect(inviteUserService.resendInvite).toHaveBeenCalledWith(
      'new-user@example.com',
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        emailInvited: 'new-user@example.com',
      }),
    );
  });

  it('validate delegates to service', async () => {
    inviteUserService.validateInvite.mockResolvedValue({
      valid: true,
      emailInvited: 'new-user@example.com',
      expires: new Date(),
      active: true,
    });

    const result = await controller.validate({
      email: 'new-user@example.com',
      token: 'token',
    });

    expect(inviteUserService.validateInvite).toHaveBeenCalledWith(
      'new-user@example.com',
      'token',
    );
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        emailInvited: 'new-user@example.com',
      }),
    );
  });

  it('cancel delegates to service', async () => {
    inviteUserService.cancelInvite.mockResolvedValue({
      message: 'Invite canceled successfully',
    });

    const result = await controller.cancel({
      email: 'new-user@example.com',
      token: 'token',
    });

    expect(inviteUserService.cancelInvite).toHaveBeenCalledWith(
      'new-user@example.com',
      'token',
    );
    expect(result).toEqual({
      message: 'Invite canceled successfully',
    });
  });
});
