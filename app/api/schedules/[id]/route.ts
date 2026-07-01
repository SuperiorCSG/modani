import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/logger";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "");

    if (intent === "toggle") {
      const schedule = await db.automationSchedule.findUniqueOrThrow({ where: { id } });
      await db.automationSchedule.update({
        where: { id },
        data: { enabled: !schedule.enabled }
      });
      await writeAuditLog({
        action: AuditAction.schedule_updated,
        adminId: admin.id,
        metadata: { scheduleId: id, enabled: !schedule.enabled }
      });
    }

    if (intent === "delete") {
      await db.automationSchedule.delete({ where: { id } });
      await writeAuditLog({
        action: AuditAction.schedule_deleted,
        adminId: admin.id,
        metadata: { scheduleId: id }
      });
    }

    return NextResponse.redirect(new URL("/schedules?deleted=1", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/schedules?error=1", request.url), 303);
  }
}
