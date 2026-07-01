import path from "path";
import type { BrowserContext, Page } from "playwright";
import { AuditAction, CareLogStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/logger";
import { extractCareLogTasks } from "@/automation/extractCareLogTasks";
import { openCareLog } from "@/automation/openCareLog";
import type { ReportRow, TargetCredentials } from "@/automation/types";

async function captureEvidence(page: Page, itemId: string, enabled: boolean) {
  if (!enabled) {
    return {};
  }

  const screenshotPath = path.join("automation-artifacts", `${itemId}.png`);
  const htmlSnapshotPath = path.join("automation-artifacts", `${itemId}.html`);

  const fs = await import("fs/promises");
  await fs.mkdir(path.dirname(htmlSnapshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  await fs.writeFile(htmlSnapshotPath, await page.content(), "utf8").catch(() => undefined);

  return { screenshotPath, htmlSnapshotPath };
}

export async function processReportRow(input: {
  context: BrowserContext;
  reportPage: Page;
  runId: string;
  row: ReportRow;
  credentials: TargetCredentials;
}): Promise<void> {
  const { context, reportPage, runId, row, credentials } = input;
  const baseData = {
    runId,
    clientName: row.clientName,
    careLogDate: row.careLogDate,
    reportRowKey: row.reportRowKey,
    sourceUrl: row.sourceUrl ?? reportPage.url(),
    clientSigned: row.clientSigned,
    caregiverSigned: row.caregiverSigned
  };

  if (!row.clientSigned || !row.caregiverSigned) {
    const item = await db.careLogItem.upsert({
      where: { reportRowKey_careLogDate: { reportRowKey: row.reportRowKey, careLogDate: row.careLogDate } },
      update: {
        ...baseData,
        status: CareLogStatus.skipped,
        skipReason: "Client and caregiver signatures are both required before review."
      },
      create: {
        ...baseData,
        status: CareLogStatus.skipped,
        skipReason: "Client and caregiver signatures are both required before review."
      }
    });
    await writeAuditLog({ action: AuditAction.care_log_skipped, runId, careLogItemId: item.id });
    return;
  }

  const careLogPage = await openCareLog(context, reportPage, row);
  const tasks = await extractCareLogTasks(careLogPage);
  const allTasksChecked = tasks.every((task) => task.isChecked);
  const status = allTasksChecked ? CareLogStatus.ready_for_review : CareLogStatus.skipped;
  const evidence = await captureEvidence(careLogPage, row.reportRowKey.replace(/[^a-z0-9]/gi, "-"), credentials.captureSnapshots);
  const item = await db.careLogItem.upsert({
    where: { reportRowKey_careLogDate: { reportRowKey: row.reportRowKey, careLogDate: row.careLogDate } },
    update: {
      ...baseData,
      sourceUrl: careLogPage.url(),
      allTasksChecked,
      status,
      skipReason: allTasksChecked ? null : "One or more tasks are crossed, missing, or incomplete.",
      ...evidence,
      tasks: {
        deleteMany: {},
        create: tasks.map((task) => ({
          taskTime: task.taskTime,
          taskName: task.taskName,
          statusLabel: task.statusLabel,
          isChecked: task.isChecked
        }))
      }
    },
    create: {
      ...baseData,
      sourceUrl: careLogPage.url(),
      allTasksChecked,
      status,
      skipReason: allTasksChecked ? null : "One or more tasks are crossed, missing, or incomplete.",
      ...evidence,
      tasks: {
        create: tasks.map((task) => ({
          taskTime: task.taskTime,
          taskName: task.taskName,
          statusLabel: task.statusLabel,
          isChecked: task.isChecked
        }))
      }
    }
  });

  await writeAuditLog({
    action: allTasksChecked ? AuditAction.care_log_ready_for_review : AuditAction.care_log_skipped,
    runId,
    careLogItemId: item.id
  });

  if (careLogPage !== reportPage) {
    await careLogPage.close().catch(() => undefined);
  }
}
