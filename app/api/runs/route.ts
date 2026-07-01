import { AuditAction, RunTriggerType } from "@prisma/client";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueAutomationRun } from "@/lib/queue";
import { writeAuditLog } from "@/lib/logger";

function startOfDate(dateText: string, timezone: string): Date {
  return fromZonedTime(`${dateText} 00:00:00`, timezone);
}

function endOfDate(dateText: string, timezone: string): Date {
  return fromZonedTime(`${dateText} 23:59:59`, timezone);
}

function yesterdayDateText(timezone: string): string {
  return formatInTimeZone(new Date(Date.now() - 24 * 60 * 60 * 1000), timezone, "yyyy-MM-dd");
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "yesterday");
    const timezone = String(formData.get("timezone") ?? "America/New_York");
    const singleDate = String(formData.get("singleDate") ?? "");
    const fromDate = String(formData.get("fromDate") ?? "");
    const toDate = String(formData.get("toDate") ?? "");

    const dateFromText = mode === "yesterday" ? yesterdayDateText(timezone) : mode === "single" ? singleDate : fromDate;
    const dateToText = mode === "range" ? toDate : dateFromText;
    if (!dateFromText || !dateToText) {
      throw new Error("Date selection is required");
    }

    const run = await db.automationRun.create({
      data: {
        triggerType: RunTriggerType.manual,
        dateFrom: startOfDate(dateFromText, timezone),
        dateTo: endOfDate(dateToText, timezone),
        timezone
      }
    });
    await enqueueAutomationRun(run.id);
    await writeAuditLog({
      action: AuditAction.manual_run_started,
      adminId: admin.id,
      runId: run.id,
      metadata: { mode, dateFrom: dateFromText, dateTo: dateToText, timezone }
    });

    return NextResponse.redirect(new URL(`/runs?queued=${run.id}`, request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/runs?error=1", request.url), 303);
  }
}
