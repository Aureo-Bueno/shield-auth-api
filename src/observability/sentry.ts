import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { ConfigService } from '@nestjs/config';

const parseSampleRate = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
};

export const initializeSentry = (configService: ConfigService): void => {
  const dsn = configService.get<string>('SENTRY_DSN');
  const isProfilingEnabled =
    configService.get<string>('SENTRY_PROFILING_ENABLED') === 'true';
  const tracesSampleRate = parseSampleRate(
    configService.get<string>('SENTRY_TRACES_SAMPLE_RATE'),
    0,
  );
  const profileSessionSampleRate = parseSampleRate(
    configService.get<string>('SENTRY_PROFILE_SESSION_SAMPLE_RATE'),
    0,
  );
  const profileLifecycle =
    configService.get<string>('SENTRY_PROFILE_LIFECYCLE') === 'manual'
      ? 'manual'
      : 'trace';

  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    skipOpenTelemetrySetup: true,
    environment: configService.get<string>('NODE_ENV'),
    release: configService.get<string>('SENTRY_RELEASE'),
    tracesSampleRate,
    integrations: isProfilingEnabled ? [nodeProfilingIntegration()] : [],
    profileSessionSampleRate,
    profileLifecycle: isProfilingEnabled ? profileLifecycle : undefined,
  });
};
