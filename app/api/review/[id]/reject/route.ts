import { AuditAction, CareLogStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/logger";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const item = await db.careLogItem.update({
      where: { id },
      data: {
        status: CareLogStatus.skipped,
        skipReason: "Rejected by admin during review."
      }
    });
    await writeAuditLog({
      action: AuditAction.care_log_skipped,
      adminId: admin.id,
      runId: item.runId,
      careLogItemId: item.id,
      metadata: { reason: "Rejected by admin during review" }
    });
    return NextResponse.redirect(new URL("/review?rejected=1", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/review?error=1", request.url), 303);
  }
}
