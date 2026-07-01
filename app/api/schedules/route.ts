import { AuditAction, ScheduleKind } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/logger";

function startOfDate(dateText: string, timezone: string): Date {
  return fromZonedTime(`${dateText} 00:00:00`, timezone);
}

function endOfDate(dateText: string, timezone: string): Date {
  return fromZonedTime(`${dateText} 23:59:59`, timezone);
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "");
    const kind = String(formData.get("kind") ?? "daily") as ScheduleKind;
    const timezone = String(formData.get("timezone") ?? "America/New_York");
    const timeOfDay = String(formData.get("timeOfDay") ?? "");
    const runOnceAtText = String(formData.get("runOnceAt") ?? "");
    const startDateText = String(formData.get("startDate") ?? "");
    const endDateText = String(formData.get("endDate") ?? "") || startDateText;

    const schedule = await db.automationSchedule.create({
      data: {
        name,
        kind,
        timezone,
        timeOfDay: kind === ScheduleKind.daily ? timeOfDay : null,
        runOnceAt: kind === ScheduleKind.daily || !runOnceAtText ? null : fromZonedTime(runOnceAtText, timezone),
        startDate: kind === ScheduleKind.daily || !startDateText ? null : startOfDate(startDateText, timezone),
        endDate: kind === ScheduleKind.daily || !endDateText ? null : endOfDate(endDateText, timezone),
        createdByAdmin: admin.id
      }
    });

    await writeAuditLog({
      action: AuditAction.schedule_created,
      adminId: admin.id,
      metadata: { scheduleId: schedule.id, kind, timezone }
    });

    return NextResponse.redirect(new URL("/schedules?saved=1", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/schedules?error=1", request.url), 303);
  }
}
