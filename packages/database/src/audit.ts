import { PrismaClient, AuditAction, AuditLog, Prisma } from './client';

/**
 * Sensitive field regex: matches passwords, tokens, API keys, credentials, hashes, secrets, and authorization values.
 * Rule: "Never store passwords, authentication tokens or other secrets."
 */
const SENSITIVE_KEY_PATTERN = /password|token|secret|credential|auth|hash|salt|bearer|private_key|apikey/i;

/**
 * Common token value patterns (JWTs, Bearer headers, long hex/base64 auth tokens).
 */
const SENSITIVE_VALUE_PATTERN = /^(Bearer\s+[A-Za-z0-9_\-\.]+|ey[A-Za-z0-9_\-]{10,}\.ey[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]*|[A-Fa-f0-9]{32,64})$/;

/**
 * Recursively scrubs passwords, authentication tokens, credentials, and secrets
 * from any object, array, or primitive before storing in audit records.
 */
export function sanitizeAuditValues<T = any>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    if (SENSITIVE_VALUE_PATTERN.test(data.trim())) {
      return '[REDACTED_SECRET]' as unknown as T;
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditValues(item)) as unknown as T;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeAuditValues(value);
    }
  }

  return sanitized as T;
}

export interface RecordAuditLogParams {
  actor: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
}

/**
 * Persists an administrative action to the audit log.
 * Enforces secret sanitization on before/after states.
 *
 * Tracks:
 * - actor
 * - action
 * - entity
 * - entity ID
 * - timestamp
 * - relevant before/after values
 */
export async function recordAuditLog(
  prisma: PrismaClient | Prisma.TransactionClient,
  params: RecordAuditLogParams
): Promise<AuditLog> {
  const { actor, action, entity, entityId, before, after } = params;

  const sanitizedBefore = before !== undefined ? sanitizeAuditValues(before) : null;
  const sanitizedAfter = after !== undefined ? sanitizeAuditValues(after) : null;

  return (prisma as PrismaClient).auditLog.create({
    data: {
      actor: actor?.trim() || 'system',
      action,
      entity: entity.trim(),
      entityId: entityId.trim(),
      before: sanitizedBefore,
      after: sanitizedAfter,
    },
  });
}

export interface GetAuditLogsOptions {
  action?: AuditAction;
  entity?: string;
  entityId?: string;
  actor?: string;
  limit?: number;
  offset?: number;
}

export interface GetAuditLogsResult {
  logs: AuditLog[];
  total: number;
}

/**
 * Retrieves audit log entries in reverse chronological order (newest first).
 */
export async function getAuditLogs(
  prisma: PrismaClient,
  options: GetAuditLogsOptions = {}
): Promise<GetAuditLogsResult> {
  const { action, entity, entityId, actor, limit = 50, offset = 0 } = options;

  const where: Prisma.AuditLogWhereInput = {};

  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;
  if (actor) where.actor = { contains: actor, mode: 'insensitive' };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
