import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import RefreshToken from '../entities/refresh-token.entity';
import { sign, verify } from 'jsonwebtoken';
import { UsersService } from '../../users/services/users.service';
import { User } from '../../users/entities/user.entity';
import { PasswordCryptoService } from '../../crypto/services/password-crypto.service';
import { AwsSesService } from '../../aws/services/aws-ses.service';
import { randomBytes } from 'node:crypto';
import PasswordResetToken from '../entities/password-reset-token.entity';

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

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type SimpleMessage = {
  message: string;
};

type LoginAttemptState = {
  failCount: number;
  updatedAt: Date;
  lockedUntil?: Date;
};

@Injectable()
export class AuthService {
  private refreshTokens: RefreshToken[] = [];
  private passwordResetTokens: PasswordResetToken[] = [];
  private refreshTokenSequence = 0;
  private emailLoginAttempts = new Map<string, LoginAttemptState>();
  private ipLoginAttempts = new Map<string, LoginAttemptState>();
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly resetPasswordUrl: string;
  private readonly resetPasswordExpiresHours: number;
  private readonly maxLoginAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly userService: UsersService,
    private readonly configService: ConfigService,
    private readonly passwordCryptoService: PasswordCryptoService,
    private readonly awsSesService: AwsSesService,
  ) {
    const accessSecret = this.configService.get<string>('ACCESS_SECRET');
    if (!accessSecret) {
      throw new Error('ACCESS_SECRET is not set');
    }

    const refreshSecret = this.configService.get<string>('REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('REFRESH_SECRET is not set');
    }

    const resetPasswordUrl =
      this.configService.get<string>('RESET_PASSWORD_URL') ??
      'http://localhost:5173/reset-password';
    const resetPasswordExpiresHoursRaw =
      this.configService.get<string>('RESET_PASSWORD_EXPIRES_HOURS') ?? '1';
    const resetPasswordExpiresHours = Number(resetPasswordExpiresHoursRaw);
    if (
      !Number.isFinite(resetPasswordExpiresHours) ||
      resetPasswordExpiresHours <= 0 ||
      !Number.isInteger(resetPasswordExpiresHours)
    ) {
      throw new Error(
        'RESET_PASSWORD_EXPIRES_HOURS must be a positive integer',
      );
    }

    const maxLoginAttemptsRaw =
      this.configService.get<string>('AUTH_MAX_LOGIN_ATTEMPTS') ?? '5';
    const maxLoginAttempts = Number(maxLoginAttemptsRaw);
    if (
      !Number.isFinite(maxLoginAttempts) ||
      maxLoginAttempts <= 0 ||
      !Number.isInteger(maxLoginAttempts)
    ) {
      throw new Error('AUTH_MAX_LOGIN_ATTEMPTS must be a positive integer');
    }

    const lockoutMinutesRaw =
      this.configService.get<string>('AUTH_LOCKOUT_MINUTES') ?? '15';
    const lockoutMinutes = Number(lockoutMinutesRaw);
    if (
      !Number.isFinite(lockoutMinutes) ||
      lockoutMinutes <= 0 ||
      !Number.isInteger(lockoutMinutes)
    ) {
      throw new Error('AUTH_LOCKOUT_MINUTES must be a positive integer');
    }

    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
    this.resetPasswordUrl = resetPasswordUrl;
    this.resetPasswordExpiresHours = resetPasswordExpiresHours;
    this.maxLoginAttempts = maxLoginAttempts;
    this.lockoutMinutes = lockoutMinutes;
  }

  async refresh(refreshStr: string): Promise<AuthTokens | undefined> {
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

    const rotatedRefreshToken = this.rotateRefreshTokenForDevice(refreshToken);

    return {
      accessToken: sign(accessToken, this.accessSecret, { expiresIn: '1h' }),
      refreshToken: rotatedRefreshToken.sign(this.refreshSecret),
    };
  }

  private retrieveRefreshToken(refreshStr: string): RefreshToken | null {
    try {
      const decoded = verify(refreshStr, this.refreshSecret);
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
  ): Promise<AuthTokens | undefined> {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedIp = this.normalizeIpAddress(values.ipAddress);
    this.assertLoginNotLocked(normalizedEmail, normalizedIp);

    const user = await this.userService.findByEmail(normalizedEmail);
    if (!user) {
      this.registerFailedLogin(normalizedEmail, normalizedIp);
      return undefined;
    }

    const isPasswordValid = await this.verifyPassword(user.password, password);
    if (!isPasswordValid) {
      this.registerFailedLogin(normalizedEmail, normalizedIp);
      return undefined;
    }

    this.clearLoginAttempts(normalizedEmail, normalizedIp);
    return this.newRefreshAndAccessToken(user, values);
  }

  async signUp(
    name: string,
    email: string,
    password: string,
    values: LoginValues,
  ): Promise<AuthTokens | undefined> {
    const normalizedEmail = this.normalizeEmail(email);
    const existingUser = await this.userService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash =
      await this.passwordCryptoService.hashPassword(password);
    const user = await this.userService.create({
      name,
      email: normalizedEmail,
      password: passwordHash,
    });

    return this.newRefreshAndAccessToken(user, values);
  }

  async forgotPassword(email: string): Promise<SimpleMessage> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userService.findByEmail(normalizedEmail);

    const message =
      'If the email exists, a password reset link has been sent successfully';

    if (!user) {
      return { message };
    }

    this.deactivateActivePasswordResetsForUser(user.id);

    const passwordResetToken = this.newPasswordResetToken(user);
    this.passwordResetTokens.push(passwordResetToken);

    await this.awsSesService.sendEmail({
      to: user.email,
      subject: 'Reset de senha',
      textBody: this.buildResetPasswordTextBody(passwordResetToken),
      htmlBody: this.buildResetPasswordHtmlBody(passwordResetToken),
    });

    return { message };
  }

  async resetPassword(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<SimpleMessage> {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedToken = token.trim();
    const user = await this.userService.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestException('Invalid password reset token');
    }

    const passwordResetToken = this.passwordResetTokens.find(
      (item: PasswordResetToken) =>
        item.userId === user.id &&
        item.email === normalizedEmail &&
        item.token === trimmedToken,
    );

    if (!passwordResetToken) {
      throw new BadRequestException('Invalid password reset token');
    }

    if (!passwordResetToken.active) {
      throw new BadRequestException('Password reset token is no longer active');
    }

    if (passwordResetToken.expires.getTime() <= Date.now()) {
      passwordResetToken.active = false;
      passwordResetToken.updatedAt = new Date();
      throw new BadRequestException('Password reset token has expired');
    }

    const newPasswordHash =
      await this.passwordCryptoService.hashPassword(newPassword);
    const updatedUser = await this.userService.updatePassword(
      user.id,
      newPasswordHash,
    );
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.deactivateActivePasswordResetsForUser(user.id);
    this.revokeAllUserRefreshTokens(user.id);

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<SimpleMessage> {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const isCurrentPasswordValid = await this.verifyPassword(
      user.password,
      currentPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is invalid');
    }

    const newPasswordHash =
      await this.passwordCryptoService.hashPassword(newPassword);
    await this.userService.updatePassword(user.id, newPasswordHash);

    this.revokeAllUserRefreshTokens(user.id);
    this.deactivateActivePasswordResetsForUser(user.id);

    return { message: 'Password changed successfully' };
  }

  private newRefreshAndAccessToken(
    user: User,
    values: LoginValues,
  ): AuthTokens {
    const refreshObject = this.createRefreshToken(user.id, values);
    this.refreshTokens.push(refreshObject);

    const accessToken: AccessTokenPayload = {
      userId: user.id,
    };

    return {
      refreshToken: refreshObject.sign(this.refreshSecret),
      accessToken: sign(accessToken, this.accessSecret, {
        expiresIn: '1h',
      }),
    };
  }

  logout(refreshStr: string): void {
    const targetRefreshToken = this.retrieveRefreshToken(refreshStr);

    if (!targetRefreshToken) {
      return;
    }

    // delete refresh token from the in-memory store
    this.refreshTokens = this.refreshTokens.filter(
      (refreshToken: RefreshToken) => refreshToken.id !== targetRefreshToken.id,
    );
  }

  private async verifyPassword(
    storedPassword: string,
    candidatePassword: string,
  ): Promise<boolean> {
    if (!storedPassword.startsWith('$argon2')) {
      // Keep backward compatibility for legacy in-memory seed users.
      return storedPassword === candidatePassword;
    }

    return this.passwordCryptoService.verifyPassword(
      storedPassword,
      candidatePassword,
    );
  }

  private isRefreshTokenPayload(value: unknown): value is RefreshTokenPayload {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return typeof (value as { id?: unknown }).id === 'number';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeIpAddress(ipAddress: string): string {
    return ipAddress.trim();
  }

  private revokeAllUserRefreshTokens(userId: number): void {
    this.refreshTokens = this.refreshTokens.filter(
      (refreshToken: RefreshToken) => refreshToken.userId !== userId,
    );
  }

  private deactivateActivePasswordResetsForUser(userId: number): void {
    const now = new Date();
    this.passwordResetTokens.forEach(
      (passwordResetToken: PasswordResetToken) => {
        if (passwordResetToken.userId === userId && passwordResetToken.active) {
          passwordResetToken.active = false;
          passwordResetToken.updatedAt = now;
        }
      },
    );
  }

  private newPasswordResetToken(user: User): PasswordResetToken {
    const now = new Date();
    return new PasswordResetToken({
      id:
        this.passwordResetTokens.length === 0
          ? 0
          : this.passwordResetTokens[this.passwordResetTokens.length - 1].id +
            1,
      userId: user.id,
      email: user.email,
      createdAt: now,
      updatedAt: now,
      expires: new Date(
        now.getTime() + this.resetPasswordExpiresHours * 60 * 60 * 1000,
      ),
      token: randomBytes(32).toString('hex'),
      active: true,
    });
  }

  private buildResetPasswordUrl(
    passwordResetToken: PasswordResetToken,
  ): string {
    const separator = this.resetPasswordUrl.includes('?') ? '&' : '?';
    return `${this.resetPasswordUrl}${separator}token=${passwordResetToken.token}&email=${encodeURIComponent(passwordResetToken.email)}`;
  }

  private buildResetPasswordTextBody(
    passwordResetToken: PasswordResetToken,
  ): string {
    const resetUrl = this.buildResetPasswordUrl(passwordResetToken);
    return [
      'Voce solicitou reset de senha.',
      `Link de reset: ${resetUrl}`,
      `Expira em: ${passwordResetToken.expires.toISOString()}`,
    ].join('\n');
  }

  private buildResetPasswordHtmlBody(
    passwordResetToken: PasswordResetToken,
  ): string {
    const resetUrl = this.buildResetPasswordUrl(passwordResetToken);
    return [
      '<p>Voce solicitou reset de senha.</p>',
      `<p><a href="${resetUrl}">Clique aqui para resetar sua senha</a></p>`,
      `<p>Expira em: ${passwordResetToken.expires.toISOString()}</p>`,
    ].join('');
  }

  private rotateRefreshTokenForDevice(
    oldRefreshToken: RefreshToken,
  ): RefreshToken {
    this.refreshTokens = this.refreshTokens.filter(
      (refreshToken: RefreshToken) =>
        !(
          refreshToken.userId === oldRefreshToken.userId &&
          refreshToken.ipAddress === oldRefreshToken.ipAddress &&
          refreshToken.userAgent === oldRefreshToken.userAgent
        ),
    );

    const rotated = new RefreshToken({
      id: this.nextRefreshTokenId(),
      userId: oldRefreshToken.userId,
      ipAddress: oldRefreshToken.ipAddress,
      userAgent: oldRefreshToken.userAgent,
    });

    this.refreshTokens.push(rotated);
    return rotated;
  }

  private createRefreshToken(
    userId: number,
    values: LoginValues,
  ): RefreshToken {
    const userAgent = Array.isArray(values.userAgent)
      ? values.userAgent.join(', ')
      : (values.userAgent ?? 'unknown');

    return new RefreshToken({
      id: this.nextRefreshTokenId(),
      ipAddress: this.normalizeIpAddress(values.ipAddress),
      userId,
      userAgent,
    });
  }

  private nextRefreshTokenId(): number {
    const nextId = this.refreshTokenSequence;
    this.refreshTokenSequence += 1;
    return nextId;
  }

  private assertLoginNotLocked(email: string, ipAddress: string): void {
    const now = Date.now();
    const emailState = this.emailLoginAttempts.get(email);
    const ipState = this.ipLoginAttempts.get(ipAddress);

    const lockedUntilTimestamp = Math.max(
      emailState?.lockedUntil?.getTime() ?? 0,
      ipState?.lockedUntil?.getTime() ?? 0,
    );

    if (lockedUntilTimestamp > now) {
      const retryInSeconds = Math.ceil((lockedUntilTimestamp - now) / 1000);
      throw new HttpException(
        `Too many failed login attempts. Try again in ${retryInSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailedLogin(email: string, ipAddress: string): void {
    this.emailLoginAttempts.set(
      email,
      this.bumpAttemptState(this.emailLoginAttempts.get(email)),
    );
    this.ipLoginAttempts.set(
      ipAddress,
      this.bumpAttemptState(this.ipLoginAttempts.get(ipAddress)),
    );
  }

  private clearLoginAttempts(email: string, ipAddress: string): void {
    this.emailLoginAttempts.delete(email);
    this.ipLoginAttempts.delete(ipAddress);
  }

  private bumpAttemptState(previous?: LoginAttemptState): LoginAttemptState {
    const now = new Date();
    const failCount = (previous?.failCount ?? 0) + 1;
    if (failCount >= this.maxLoginAttempts) {
      return {
        failCount: 0,
        updatedAt: now,
        lockedUntil: new Date(now.getTime() + this.lockoutMinutes * 60 * 1000),
      };
    }

    return {
      failCount,
      updatedAt: now,
      lockedUntil: previous?.lockedUntil,
    };
  }
}
