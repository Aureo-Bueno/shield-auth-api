declare module 'passport-jwt' {
  export type JwtFromRequestFunction = (req: unknown) => string | null;

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): JwtFromRequestFunction;
  };

  export interface StrategyOptions {
    jwtFromRequest: JwtFromRequestFunction;
    secretOrKey: string;
    ignoreExpiration?: boolean;
  }

  export class Strategy {
    constructor(options: StrategyOptions, verify?: (...args: any[]) => void);
    name: string;
  }
}
