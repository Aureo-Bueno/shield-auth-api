import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from './authorization.guard';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { POLICIES_KEY } from './policies.decorator';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '../../users/entities/user-role.enum';

const buildContext = (user?: any): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: { id: '1' },
      }),
    }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  }) as unknown as ExecutionContext;

describe('AuthorizationGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  let guard: AuthorizationGuard;

  beforeEach(() => {
    (reflector.getAllAndOverride as jest.Mock).mockReset();
    guard = new AuthorizationGuard(reflector);
  });

  it('throws when user is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      'Authentication required',
    );
  });

  it('throws when required role is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === ROLES_KEY) {
        return [UserRole.ADMIN];
      }
      return [];
    });

    expect(() =>
      guard.canActivate(
        buildContext({
          role: UserRole.USER,
          permissions: ['users:read:self'],
        }),
      ),
    ).toThrow('Insufficient role');
  });

  it('throws when required permission is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === ROLES_KEY) {
        return [];
      }
      if (key === PERMISSIONS_KEY) {
        return ['audit:read'];
      }
      return [];
    });

    expect(() =>
      guard.canActivate(
        buildContext({
          role: UserRole.ADMIN,
          permissions: ['users:read:any'],
        }),
      ),
    ).toThrow('Insufficient permission');
  });

  it('throws when a policy denies access', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === POLICIES_KEY) {
        return [() => false];
      }
      return [];
    });

    expect(() =>
      guard.canActivate(
        buildContext({
          role: UserRole.ADMIN,
          permissions: ['audit:read'],
        }),
      ),
    ).toThrow('Policy denied access');
  });

  it('allows when role, permission and policies are satisfied', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === ROLES_KEY) {
        return [UserRole.ADMIN];
      }
      if (key === PERMISSIONS_KEY) {
        return ['audit:read'];
      }
      if (key === POLICIES_KEY) {
        return [() => true];
      }
      return [];
    });

    const result = guard.canActivate(
      buildContext({
        role: UserRole.ADMIN,
        permissions: ['audit:read', 'users:read:any'],
      }),
    );

    expect(result).toBe(true);
  });

  it('handles undefined metadata as empty requirements', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    const result = guard.canActivate(
      buildContext({
        role: UserRole.USER,
        permissions: [],
      }),
    );

    expect(result).toBe(true);
  });
});
