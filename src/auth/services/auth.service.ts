import { Injectable } from '@nestjs/common';
import RefreshToken from '../entities/refresh-token.entity';
import { sign, verify } from 'jsonwebtoken';
import { UsersService } from '../../users/services/users.service';
import { User } from '../../users/entities/user.entity';

type AccessTokenPayload = {
  userId: number;
};

type RefreshTokenPayload = {
  id: number;
};

type LoginValues = {
  userAgent?: string | string[];
  ipAddress: string;
};

@Injectable()
export class AuthService {
  private refreshTokens: RefreshToken[] = [];

  constructor(private readonly userService: UsersService) {}

  async refresh(refreshStr: string): Promise<string | undefined> {
    const refreshToken = this.retrieveRefreshToken(refreshStr);
    if (!refreshToken) {
      return undefined;
    }

    const user = await this.userService.findOne(refreshToken.userId);
    if (!user) {
      return undefined;
    }

    const accessToken: AccessTokenPayload = {
      userId: refreshToken.userId,
    };

    return sign(accessToken, this.getAccessSecret(), { expiresIn: '1h' });
  }

  private retrieveRefreshToken(refreshStr: string): RefreshToken | null {
    try {
      const decoded = verify(refreshStr, this.getRefreshSecret());
      if (!this.isRefreshTokenPayload(decoded)) {
        return null;
      }
      return (
        this.refreshTokens.find(
          (token: RefreshToken) => token.id === decoded.id,
        ) ?? null
      );
    } catch {
      return null;
    }
  }

  async login(
    email: string,
    password: string,
    values: LoginValues,
  ): Promise<{ accessToken: string; refreshToken: string } | undefined> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return undefined;
    }

    //verify your user -- user argon2 for password hashing!!
    if (user.password !== password) {
      return undefined;
    }

    return this.newRefreshAndAccessToken(user, values);
  }

  private newRefreshAndAccessToken(
    user: User,
    values: LoginValues,
  ): { accessToken: string; refreshToken: string } {
    const userAgent = Array.isArray(values.userAgent)
      ? values.userAgent.join(', ')
      : (values.userAgent ?? 'unknown');
    const refreshObject = new RefreshToken({
      id:
        this.refreshTokens.length === 0
          ? 0
          : this.refreshTokens[this.refreshTokens.length - 1].id + 1,
      ipAddress: values.ipAddress,
      userId: user.id,
      userAgent,
    });
    this.refreshTokens.push(refreshObject);

    const accessToken: AccessTokenPayload = {
      userId: user.id,
    };

    return {
      refreshToken: refreshObject.sign(),
      accessToken: sign(accessToken, this.getAccessSecret(), {
        expiresIn: '1h',
      }),
    };
  }

  logout(refreshStr: string): void {
    const refreshToken = this.retrieveRefreshToken(refreshStr);

    if (!refreshToken) {
      return;
    }

    //delete refreshtoken from db
    this.refreshTokens = this.refreshTokens.filter(
      (refreshToken: RefreshToken) => refreshToken.id !== refreshToken.id,
    );
  }

  private getAccessSecret(): string {
    const secret = process.env.ACCESS_SECRET;
    if (!secret) {
      throw new Error('ACCESS_SECRET is not set');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    const secret = process.env.REFRESH_SECRET;
    if (!secret) {
      throw new Error('REFRESH_SECRET is not set');
    }
    return secret;
  }

  private isRefreshTokenPayload(value: unknown): value is RefreshTokenPayload {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return typeof (value as { id?: unknown }).id === 'number';
  }
}
