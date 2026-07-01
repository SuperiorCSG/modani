import "dotenv/config";
import { AuditAction, ScheduleKind, RunTriggerType } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db";
import { enqueueAutomationRun } from "@/lib/queue";
import { logError, logInfo, writeAuditLog } from "@/lib/logger";

const POLL_INTERVAL_MS = 60_000;

function startOfDateInTimezone(dateText: string, timezone: string): Date {
  return fromZonedTime(`${dateText} 00:00:00`, timezone);
}

function endOfDateInTimezone(dateText: string, timezone: string): Date {
  return fromZonedTime(`${dateText} 23:59:59`, timezone);
}

function yesterdayRange(timezone: string) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateText = formatInTimeZone(yesterday, timezone, "yyyy-MM-dd");
  return {
    from: startOfDateInTimezone(dateText, timezone),
    to: endOfDateInTimezone(dateText, timezone)
  };
}

function shouldRunDaily(timezone: string, timeOfDay: string | null, lastQueuedAt: Date | null): boolean {
  if (!timeOfDay) {
    return false;
  }
  const nowKey = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd HH:mm");
  const scheduledKey = `${formatInTimeZone(new Date(), timezone, "yyyy-MM-dd")} ${timeOfDay}`;
  const alreadyQueuedToday = lastQueuedAt
    ? formatInTimeZone(lastQueuedAt, timezone, "yyyy-MM-dd") === formatInTimeZone(new Date(), timezone, "yyyy-MM-dd")
    : false;
  return nowKey >= scheduledKey && !alreadyQueuedToday;
}

async function queueDueSchedules(): Promise<void> {
  const schedules = await db.automationSchedule.findMany({ where: { enabled: true } });

  for (const schedule of schedules) {
    try {
      const now = new Date();
      let dateFrom: Date | null = null;
      let dateTo: Date | null = null;

      if (schedule.kind === ScheduleKind.daily && shouldRunDaily(schedule.timezone, schedule.timeOfDay, schedule.lastQueuedAt)) {
        const range = yesterdayRange(schedule.timezone);
        dateFrom = range.from;
        dateTo = range.to;
      }

      if (
        schedule.kind !== ScheduleKind.daily &&
        schedule.runOnceAt &&
        schedule.runOnceAt <= now &&
        schedule.lastQueuedAt === null &&
        schedule.startDate &&
        schedule.endDate
      ) {
        dateFrom = schedule.startDate;
        dateTo = schedule.endDate;
      }

      if (!dateFrom || !dateTo) {
        continue;
      }

      const run = await db.automationRun.create({
        data: {
          triggerType: RunTriggerType.schedule,
          scheduleId: schedule.id,
          dateFrom,
          dateTo,
          timezone: schedule.timezone
        }
      });
      await enqueueAutomationRun(run.id);
      await db.automationSchedule.update({
        where: { id: schedule.id },
        data: {
          lastQueuedAt: now,
          enabled: schedule.kind === ScheduleKind.daily
        }
      });
      await writeAuditLog({
        action: AuditAction.automation_run_started,
        runId: run.id,
        metadata: { queuedBy: "scheduler", scheduleId: schedule.id }
      });
      logInfo("Queued scheduled automation run", { scheduleId: schedule.id, runId: run.id });
    } catch (error) {
      logError("Failed to queue schedule", {
        scheduleId: schedule.id,
        message: error instanceof Error ? error.message : "Unknown scheduler error"
      });
    }
  }
}

setInterval(() => {
  queueDueSchedules().catch((error) =>
    logError("Scheduler polling failed", { message: error instanceof Error ? error.message : "Unknown scheduler error" })
  );
}, POLL_INTERVAL_MS);

queueDueSchedules().catch((error) =>
  logError("Initial scheduler polling failed", { message: error instanceof Error ? error.message : "Unknown scheduler error" })
);
