import { UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError } from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('throws UnauthorizedException for invalid JWT errors', () => {
    const guard = new JwtAuthGuard();
    const jwtError = new JsonWebTokenError('Invalid JWT');

    expect(() => guard.handleRequest(null, null, jwtError, null, null)).toThrow(
      UnauthorizedException,
    );
  });

  it('returns user when no JWT error is present', () => {
    const guard = new JwtAuthGuard();
    const user = { userId: 1 };

    const result = guard.handleRequest(null, user, null, null, null);

    expect(result).toBe(user);
  });
});
