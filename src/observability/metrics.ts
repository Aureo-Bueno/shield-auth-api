import client from 'prom-client';

let initialized = false;

export const initializeMetrics = (): void => {
  if (initialized) return;
  initialized = true;

  client.collectDefaultMetrics();
};

export const getMetricsContentType = (): string => client.register.contentType;

export const getMetrics = async (): Promise<string> =>
  client.register.metrics();
