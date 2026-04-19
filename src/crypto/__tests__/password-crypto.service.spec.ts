import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { PasswordCryptoService } from '../services/password-crypto.service';

describe('PasswordCryptoService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'PASSWORD_PEPPER') {
        return 'test-pepper';
      }
      return undefined;
    }),
  };

  it('hashes and verifies password with pepper', async () => {
    const service = new PasswordCryptoService(
      configService as unknown as ConfigService,
    );

    const hash = await service.hashPassword('secret123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(
      argon2.verify(hash, 'secret123test-pepper'),
    ).resolves.toBe(true);
    await expect(service.verifyPassword(hash, 'secret123')).resolves.toBe(true);
    await expect(service.verifyPassword(hash, 'wrong')).resolves.toBe(false);
  });
});
