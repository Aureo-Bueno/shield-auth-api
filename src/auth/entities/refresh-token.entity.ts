import { sign } from 'jsonwebtoken';

class RefreshToken {
  constructor(init?: Partial<RefreshToken>) {
    Object.assign(this, init);
  }

  id!: number;
  userId!: number;
  userAgent!: string;
  ipAddress!: string;

  sign(secret: string): string {
    return sign({ ...this }, secret);
  }
}

export default RefreshToken;
