import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  beforeAll(() => {
    process.env.ACCESS_SECRET = 'test-access-secret';
  });

  it('validate returns the user id payload', () => {
    const strategy = new JwtStrategy();
    const result = strategy.validate({ userId: 123 });

    expect(result).toEqual({ userId: 123 });
  });
});
