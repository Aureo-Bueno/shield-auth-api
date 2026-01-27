import { sign } from 'jsonwebtoken';

class RefreshToken {
  constructor(init?: Partial<RefreshToken>) {
    Object.assign(this, init);
  }

  id: number;
  userId: number;
  userAgent: string;
  ipAddress: string;

  sign(): string {
    const secret = process.env.REFRESH_SECRET;
    if (!secret) {
      throw new Error('REFRESH_SECRET is not set');
    }

    return sign({ ...this }, secret);
  }
}

export default RefreshToken;
