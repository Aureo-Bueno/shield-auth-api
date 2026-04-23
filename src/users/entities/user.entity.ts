import { UserRole } from './user-role.enum';

export class User {
  id!: number;
  name!: string;
  email!: string;
  password!: string;
  role!: UserRole;
  department!: string;
}
