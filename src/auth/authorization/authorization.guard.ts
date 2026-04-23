import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '../../users/entities/user-role.enum';
import { Permission } from './permission.type';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PolicyHandler, POLICIES_KEY } from './policies.decorator';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const policies =
      this.reflector.getAllAndOverride<PolicyHandler[]>(POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    if (
      requiredPermissions.length > 0 &&
      !requiredPermissions.every((permission: Permission) =>
        user.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException('Insufficient permission');
    }

    if (!policies.every((policy: PolicyHandler) => policy(user, request))) {
      throw new ForbiddenException('Policy denied access');
    }

    return true;
  }
}
