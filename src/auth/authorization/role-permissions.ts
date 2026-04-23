import { UserRole } from '../../users/entities/user-role.enum';
import { Permission } from './permission.type';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    'users:read:self',
    'users:read:any',
    'invites:manage',
    'audit:read',
  ],
  [UserRole.USER]: ['users:read:self'],
};

export const getPermissionsByRole = (role: UserRole): Permission[] => {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
};
