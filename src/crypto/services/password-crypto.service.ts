import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

@Injectable()
export class PasswordCryptoService {
  private readonly passwordPepper: string;

  constructor(private readonly configService: ConfigService) {
    const passwordPepper = this.configService.get<string>('PASSWORD_PEPPER');
    if (!passwordPepper) {
      throw new Error('PASSWORD_PEPPER is not set');
    }

    this.passwordPepper = passwordPepper;
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(this.getPepperedPassword(password), {
      type: argon2.argon2id,
      salt: randomBytes(16),
    });
  }

  async verifyPassword(
    storedHash: string,
    candidatePassword: string,
  ): Promise<boolean> {
    return argon2.verify(
      storedHash,
      this.getPepperedPassword(candidatePassword),
    );
  }

  private getPepperedPassword(password: string): string {
    return `${password}${this.passwordPepper}`;
  }
}
