import { EventLoopHealthIndicator } from './event-loop.health-indicator';

jest.mock('node:perf_hooks', () => {
  const delayMonitor = {
    mean: 0,
    enable: jest.fn(),
    reset: jest.fn(),
  };

  return {
    monitorEventLoopDelay: jest.fn(() => delayMonitor),
    __delayMonitor: delayMonitor,
  };
});

describe('EventLoopHealthIndicator', () => {
  const perfModule = jest.requireMock('node:perf_hooks') as {
    __delayMonitor: {
      mean: number;
      enable: jest.Mock;
      reset: jest.Mock;
    };
  };

  beforeEach(() => {
    perfModule.__delayMonitor.mean = 0;
    perfModule.__delayMonitor.enable.mockClear();
    perfModule.__delayMonitor.reset.mockClear();
  });

  it('returns healthy when lag is below threshold', async () => {
    perfModule.__delayMonitor.mean = 50_000_000; // 50ms
    const indicator = new EventLoopHealthIndicator();

    const result = await indicator.isHealthy('event_loop', 200);

    expect(perfModule.__delayMonitor.enable).toHaveBeenCalledTimes(1);
    expect(perfModule.__delayMonitor.reset).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        event_loop: expect.objectContaining({
          status: 'up',
          lagMs: 50,
          thresholdMs: 200,
        }),
      }),
    );
  });

  it('handles non-finite lag value', async () => {
    perfModule.__delayMonitor.mean = Number.NaN;
    const indicator = new EventLoopHealthIndicator();

    const result = await indicator.isHealthy('event_loop', 1);

    expect(result.event_loop).toEqual(
      expect.objectContaining({
        status: 'up',
        lagMs: 0,
      }),
    );
  });

  it('throws when lag is above threshold', async () => {
    perfModule.__delayMonitor.mean = 500_000_000; // 500ms
    const indicator = new EventLoopHealthIndicator();

    expect(() => indicator.isHealthy('event_loop', 200)).toThrow(
      'Event loop lag is above threshold',
    );
  });
});
