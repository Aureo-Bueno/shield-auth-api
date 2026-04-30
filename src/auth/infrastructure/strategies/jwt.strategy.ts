import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  ExtractJwt,
  Strategy,
  type JwtFromRequestFunction,
} from 'passport-jwt';
import { UserRole } from '../../../users/entities/user-role.enum';
import { Permission } from '../../authorization/permission.type';
import { getPermissionsByRole } from '../../authorization/role-permissions';

type JwtPayload = {
  userId: number;
  role?: UserRole;
  permissions?: Permission[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('ACCESS_SECRET');
    if (!secret) {
      throw new Error('ACCESS_SECRET is not set');
    }

    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();

    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    const role = payload.role ?? UserRole.USER;
    return {
      userId: payload.userId,
      role,
      permissions: payload.permissions ?? getPermissionsByRole(role),
    };
  }
}
