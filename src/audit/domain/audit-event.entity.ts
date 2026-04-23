import { UserRole } from '../../users/entities/user-role.enum';

export type AuditEvent = {
  id: number;
  timestamp: string;
  actorUserId?: number;
  actorRole?: UserRole;
  method: string;
  path: string;
  statusCode: number;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  durationMs: number;
  errorMessage?: string;
};

export type CreateAuditEventInput = Omit<AuditEvent, 'id' | 'timestamp'>;
