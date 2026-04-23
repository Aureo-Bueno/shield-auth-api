import { Permission } from '../authorization/permission.type';
import { UserRole } from '../../users/entities/user-role.enum';

export type AuthenticatedUser = {
  userId: number;
  role: UserRole;
  permissions: Permission[];
};
