import { AuditAction, CareLogStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { approveAndSignCareLog } from "@/automation/approveAndSignCareLog";
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
        status: CareLogStatus.approved,
        approvedAt: new Date(),
        approvedByAdminId: admin.id
      }
    });
    await writeAuditLog({
      action: AuditAction.care_log_approved,
      adminId: admin.id,
      runId: item.runId,
      careLogItemId: item.id
    });

    await approveAndSignCareLog({ careLogItemId: id, approvingAdminId: admin.id });
    return NextResponse.redirect(new URL("/review?approved=1", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/review?error=1", request.url), 303);
  }
}
