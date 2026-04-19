import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  type JwtFromRequestFunction,
} from 'passport-jwt';

type JwtPayload = {
  userId: number;
};

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.ACCESS_SECRET;
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
    return {
      userId: payload.userId,
    };
  }
}
