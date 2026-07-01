import { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";

const SECRET_KEYS = ["password", "token", "secret", "key", "credential"];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SECRET_KEYS.some((secretKey) => key.toLowerCase().includes(secretKey)) ? "[REDACTED]" : redact(nestedValue)
      ])
    );
  }

  return value;
}

export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  console.info(message, metadata ? redact(metadata) : undefined);
}

export function logError(message: string, metadata?: Record<string, unknown>): void {
  console.error(message, metadata ? redact(metadata) : undefined);
}

export async function writeAuditLog(input: {
  action: AuditAction;
  adminId?: string;
  runId?: string;
  careLogItemId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      action: input.action,
      adminId: input.adminId,
      runId: input.runId,
      careLogItemId: input.careLogItemId,
      metadata: input.metadata ? (redact(input.metadata) as object) : undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
}
