declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
  }

  export interface JwtPayload {
    [key: string]: unknown;
  }

  export class JsonWebTokenError extends Error {
    constructor(message: string);
  }

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string,
    options?: SignOptions,
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string,
  ): JwtPayload | string;
}
