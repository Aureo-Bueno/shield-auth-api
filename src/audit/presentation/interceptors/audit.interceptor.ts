import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthenticatedUser } from '../../../auth/types/authenticated-user';
import { AuditService } from '../../application/services/audit.service';

type AuditedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuditedRequest>();
    const response = http.getResponse<Response>();
    const shouldAudit = this.shouldAuditRequest(request.method, request.path);
    if (!shouldAudit) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.auditService.record({
          actorUserId: request.user?.userId,
          actorRole: request.user?.role,
          method: request.method,
          path: request.originalUrl || request.path,
          statusCode: response.statusCode,
          success: response.statusCode < 400,
          ipAddress: request.ip ?? 'unknown',
          userAgent: String(request.headers['user-agent'] ?? 'unknown'),
          durationMs: Date.now() - startedAt,
        });
      }),
      catchError((error: unknown) => {
        const statusCode = this.extractStatusCode(error);
        this.auditService.record({
          actorUserId: request.user?.userId,
          actorRole: request.user?.role,
          method: request.method,
          path: request.originalUrl || request.path,
          statusCode,
          success: false,
          ipAddress: request.ip ?? 'unknown',
          userAgent: String(request.headers['user-agent'] ?? 'unknown'),
          durationMs: Date.now() - startedAt,
          errorMessage: this.extractErrorMessage(error),
        });

        return throwError(() => error);
      }),
    );
  }

  private shouldAuditRequest(method: string, path: string): boolean {
    if (path.startsWith('/health/') || /^\/v\d+\/health\//.test(path)) {
      return false;
    }

    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  }

  private extractStatusCode(error: unknown): number {
    if (typeof error === 'object' && error !== null) {
      const maybeStatus = (error as { status?: unknown }).status;
      if (typeof maybeStatus === 'number') {
        return maybeStatus;
      }
    }

    return 500;
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const maybeMessage = (error as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        return maybeMessage;
      }
    }

    return 'Unexpected error';
  }
}
