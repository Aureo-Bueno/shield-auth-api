import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';

const DEFAULT_ARGON2_TIME_COST = 2;
const DEFAULT_ARGON2_MEMORY_COST_KIB = 19 * 1024;
const DEFAULT_ARGON2_PARALLELISM = 1;
const DEFAULT_ARGON2_HASH_LENGTH = 32;
const ARGON2_VERSION = 0x13;

@Injectable()
export class PasswordCryptoService {
  private readonly passwordPepper: Buffer;
  private readonly timeCost: number;
  private readonly memoryCost: number;
  private readonly parallelism: number;
  private readonly hashLength: number;

  constructor(private readonly configService: ConfigService) {
    const passwordPepper = this.configService.get<string>('PASSWORD_PEPPER');
    if (!passwordPepper) {
      throw new Error('PASSWORD_PEPPER is not set');
    }

    this.passwordPepper = Buffer.from(passwordPepper, 'utf8');
    this.timeCost = this.readPositiveInteger(
      'ARGON2_TIME_COST',
      DEFAULT_ARGON2_TIME_COST,
    );
    this.memoryCost = this.readPositiveInteger(
      'ARGON2_MEMORY_COST_KIB',
      DEFAULT_ARGON2_MEMORY_COST_KIB,
    );
    this.parallelism = this.readPositiveInteger(
      'ARGON2_PARALLELISM',
      DEFAULT_ARGON2_PARALLELISM,
    );
    this.hashLength = this.readPositiveInteger(
      'ARGON2_HASH_LENGTH',
      DEFAULT_ARGON2_HASH_LENGTH,
    );
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: this.timeCost,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
      hashLength: this.hashLength,
      version: ARGON2_VERSION,
      secret: this.passwordPepper,
    });
  }

  async verifyPassword(
    storedHash: string,
    candidatePassword: string,
  ): Promise<boolean> {
    return argon2.verify(storedHash, candidatePassword, {
      secret: this.passwordPepper,
    });
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }

    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }

    return value;
  }
}
