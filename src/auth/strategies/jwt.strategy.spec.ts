import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const previousAccessSecret = process.env.ACCESS_SECRET;

  beforeAll(() => {
    process.env.ACCESS_SECRET = 'test-access-secret';
  });

  afterAll(() => {
    process.env.ACCESS_SECRET = previousAccessSecret;
  });

  it('validate returns the user id payload', () => {
    const strategy = new JwtStrategy();
    const result = strategy.validate({ userId: 123 });

    expect(result).toEqual({
      userId: 123,
      role: 'user',
      permissions: ['users:read:self'],
    });
  });

  it('validate preserves explicit role and permissions from payload', () => {
    const strategy = new JwtStrategy();
    const result = strategy.validate({
      userId: 321,
      role: 'admin' as any,
      permissions: ['audit:read'] as any,
    });

    expect(result).toEqual({
      userId: 321,
      role: 'admin',
      permissions: ['audit:read'],
    });
  });

  it('throws when ACCESS_SECRET is not set', () => {
    delete process.env.ACCESS_SECRET;

    expect(() => new JwtStrategy()).toThrow('ACCESS_SECRET is not set');

    process.env.ACCESS_SECRET = 'test-access-secret';
  });
});
