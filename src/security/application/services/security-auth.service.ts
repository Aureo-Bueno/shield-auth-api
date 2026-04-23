import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityAuthService {
  private readonly apiKeys: Set<string>;
  private readonly oauth2Tokens: Set<string>;

  constructor(private readonly configService: ConfigService) {
    this.apiKeys = new Set(this.readList('API_KEYS'));
    this.oauth2Tokens = new Set(this.readList('OAUTH2_ACCESS_TOKENS'));
  }

  isValidApiKey(apiKey: string | undefined): boolean {
    if (!apiKey || this.apiKeys.size === 0) {
      return false;
    }

    return this.apiKeys.has(apiKey.trim());
  }

  isValidOAuth2Token(token: string | undefined): boolean {
    if (!token || this.oauth2Tokens.size === 0) {
      return false;
    }

    return this.oauth2Tokens.has(token.trim());
  }

  private readList(key: string): string[] {
    const raw = this.configService.get<string>(key) ?? '';
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}
