jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    argon2id: 2,
    hash: jest.fn(),
    verify: jest.fn(),
  },
}));

import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { PasswordCryptoService } from '../services/password-crypto.service';

describe('PasswordCryptoService', () => {
  const hashMock = jest.mocked(argon2.hash);
  const verifyMock = jest.mocked(argon2.verify);

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | undefined> = {
        PASSWORD_PEPPER: 'test-pepper',
      };

      return values[key];
    }),
  };

  beforeEach(() => {
    hashMock.mockReset();
    verifyMock.mockReset();
    hashMock.mockResolvedValue('$argon2id$hash');
    verifyMock.mockResolvedValue(true);
    configService.get.mockClear();
  });

  it('hashes and verifies password with explicit argon2 parameters', async () => {
    const service = new PasswordCryptoService(
      configService as unknown as ConfigService,
    );

    const hash = await service.hashPassword('secret123');

    expect(hash).toBe('$argon2id$hash');
    expect(hashMock).toHaveBeenCalledWith(
      'secret123',
      expect.objectContaining({
        type: 2,
        timeCost: 2,
        memoryCost: 19456,
        parallelism: 1,
        hashLength: 32,
        version: 0x13,
        secret: Buffer.from('test-pepper', 'utf8'),
      }),
    );

    await expect(service.verifyPassword(hash, 'secret123')).resolves.toBe(true);
    expect(verifyMock).toHaveBeenCalledWith(hash, 'secret123', {
      secret: Buffer.from('test-pepper', 'utf8'),
    });

    verifyMock.mockResolvedValueOnce(false);
    await expect(service.verifyPassword(hash, 'wrong')).resolves.toBe(false);
  });

  it('throws when PASSWORD_PEPPER is not configured', () => {
    const missingPepperConfig = {
      get: jest.fn(() => undefined),
    };

    expect(
      () =>
        new PasswordCryptoService(
          missingPepperConfig as unknown as ConfigService,
        ),
    ).toThrow('PASSWORD_PEPPER is not set');
  });

  it('rejects invalid argon2 tuning values', () => {
    const invalidConfig = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | undefined> = {
          PASSWORD_PEPPER: 'test-pepper',
          ARGON2_TIME_COST: '0',
        };

        return values[key];
      }),
    };

    expect(
      () =>
        new PasswordCryptoService(invalidConfig as unknown as ConfigService),
    ).toThrow('ARGON2_TIME_COST must be a positive integer');
  });
});
