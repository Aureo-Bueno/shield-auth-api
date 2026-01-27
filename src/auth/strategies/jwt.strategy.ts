import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  userId: number;
};

type JwtFromRequestFunction = (req: {
  headers?: {
    authorization?: string;
  };
}) => string | null;

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.ACCESS_SECRET;
    if (!secret) {
      throw new Error('ACCESS_SECRET is not set');
    }

    const jwtFromRequest = (
      ExtractJwt.fromAuthHeaderAsBearerToken as () => JwtFromRequestFunction
    )();

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
