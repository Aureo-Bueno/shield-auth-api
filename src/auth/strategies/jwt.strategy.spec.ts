import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'ACCESS_SECRET') {
        return 'test-access-secret';
      }

      return undefined;
    }),
  };

  beforeEach(() => {
    configService.get.mockClear();
  });

  it('validate returns the user id payload', () => {
    const strategy = new JwtStrategy(configService as unknown as ConfigService);
    const result = strategy.validate({ userId: 123 });

    expect(result).toEqual({
      userId: 123,
      role: 'user',
      permissions: ['users:read:self'],
    });
  });

  it('validate preserves explicit role and permissions from payload', () => {
    const strategy = new JwtStrategy(configService as unknown as ConfigService);
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
    configService.get.mockImplementation((key: string) => {
      if (key === 'ACCESS_SECRET') {
        return undefined;
      }

      return undefined;
    });

    expect(
      () => new JwtStrategy(configService as unknown as ConfigService),
    ).toThrow('ACCESS_SECRET is not set');
  });
});
