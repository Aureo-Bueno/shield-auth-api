import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

type AuditServiceMock = {
  record: jest.Mock;
};

const buildHttpContext = (request: any, response: any): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as unknown as ExecutionContext;

describe('AuditInterceptor', () => {
  const auditService: AuditServiceMock = {
    record: jest.fn(),
  };
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    auditService.record.mockReset();
    interceptor = new AuditInterceptor(auditService as unknown as AuditService);
  });

  it('passes through non-http contexts without auditing', async () => {
    const context = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: () => of('ok'),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('ok');
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('skips auditing for health routes', async () => {
    const next: CallHandler = { handle: () => of('ok') };

    const resultA = await lastValueFrom(
      interceptor.intercept(
        buildHttpContext(
          { method: 'GET', path: '/health/live', headers: {}, ip: '1.1.1.1' },
          { statusCode: 200 },
        ),
        next,
      ),
    );
    const resultB = await lastValueFrom(
      interceptor.intercept(
        buildHttpContext(
          { method: 'GET', path: '/v1/health/live', headers: {}, ip: '1.1.1.1' },
          { statusCode: 200 },
        ),
        next,
      ),
    );

    expect(resultA).toBe('ok');
    expect(resultB).toBe('ok');
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('skips auditing for non-mutating methods', async () => {
    const next: CallHandler = { handle: () => of('ok') };

    const result = await lastValueFrom(
      interceptor.intercept(
        buildHttpContext(
          { method: 'GET', path: '/v1/users/me', headers: {}, ip: '1.1.1.1' },
          { statusCode: 200 },
        ),
        next,
      ),
    );

    expect(result).toBe('ok');
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('records successful mutating requests', async () => {
    const request = {
      method: 'POST',
      path: '/v1/auth/login',
      originalUrl: '/v1/auth/login?x=1',
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1',
      user: { userId: 10, role: 'admin' },
    };
    const response = { statusCode: 201 };
    const next: CallHandler = { handle: () => of('ok') };

    const result = await lastValueFrom(
      interceptor.intercept(buildHttpContext(request, response), next),
    );

    expect(result).toBe('ok');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 10,
        method: 'POST',
        path: '/v1/auth/login?x=1',
        statusCode: 201,
        success: true,
        userAgent: 'jest',
      }),
    );
  });

  it('records errors with provided status/message', async () => {
    const request = {
      method: 'DELETE',
      path: '/v1/users/1',
      originalUrl: '',
      headers: {},
      ip: undefined,
      user: undefined,
    };
    const response = { statusCode: 500 };
    const next: CallHandler = {
      handle: () =>
        throwError(() => ({ status: 403, message: 'denied by policy' })),
    };

    await expect(
      lastValueFrom(interceptor.intercept(buildHttpContext(request, response), next)),
    ).rejects.toEqual(expect.objectContaining({ status: 403 }));

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/v1/users/1',
        statusCode: 403,
        success: false,
        ipAddress: 'unknown',
        userAgent: 'unknown',
        errorMessage: 'denied by policy',
      }),
    );
  });

  it('records fallback error metadata for non-object errors', async () => {
    const request = {
      method: 'PATCH',
      path: '/v1/users/1',
      headers: {},
      ip: '127.0.0.1',
      user: undefined,
    };
    const response = { statusCode: 500 };
    const next: CallHandler = {
      handle: () => throwError(() => 'boom'),
    };

    await expect(
      lastValueFrom(interceptor.intercept(buildHttpContext(request, response), next)),
    ).rejects.toBe('boom');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        errorMessage: 'Unexpected error',
      }),
    );
  });
});
