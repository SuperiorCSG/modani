import path from "path";
import fs from "fs/promises";
import { chromium } from "playwright";
import { AuditAction, AutomationRunStatus, CareLogStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/encryption";
import { env } from "@/lib/env";
import { logError, writeAuditLog } from "@/lib/logger";
import { applyReportFilters } from "@/automation/applyReportFilters";
import { extractReportRows } from "@/automation/extractReportRows";
import { loginToTargetSite } from "@/automation/loginToTargetSite";
import { navigateToReports } from "@/automation/navigateToReports";
import { processReportRow } from "@/automation/processReportRow";
import type { TargetCredentials } from "@/automation/types";

async function getTargetCredentials(): Promise<TargetCredentials> {
  const stored = await db.targetSiteCredential.findFirst({ orderBy: { updatedAt: "desc" } });
  if (stored) {
    return {
      targetUrl: stored.targetUrl,
      username: stored.username,
      password: decryptSecret({
        encryptedText: stored.encryptedPassword,
        iv: stored.passwordIv,
        authTag: stored.passwordAuthTag
      }),
      signatureTemplate: stored.signatureTemplate,
      captureSnapshots: stored.captureSnapshots
    };
  }

  if (!env.TARGET_SITE_USERNAME || !env.TARGET_SITE_PASSWORD) {
    throw new Error("Target site credentials have not been configured");
  }

  return {
    targetUrl: env.TARGET_SITE_URL,
    username: env.TARGET_SITE_USERNAME,
    password: env.TARGET_SITE_PASSWORD,
    signatureTemplate: env.SIGNATURE_TEMPLATE,
    captureSnapshots: env.AUTOMATION_CAPTURE_SNAPSHOTS
  };
}

async function saveRunError(runId: string, stepName: string, message: string, currentUrl?: string, screenshotPath?: string) {
  await db.automationRun.update({
    where: { id: runId },
    data: {
      status: AutomationRunStatus.failed,
      completedAt: new Date(),
      errorMessage: `${stepName}: ${message}`
    }
  });

  await writeAuditLog({
    action: AuditAction.automation_run_completed,
    runId,
    metadata: { status: "failed", stepName, message, currentUrl, screenshotPath }
  });
}

export async function runAutomationJob(runId: string): Promise<void> {
  const run = await db.automationRun.update({
    where: { id: runId },
    data: { status: AutomationRunStatus.running, startedAt: new Date() }
  });
  await writeAuditLog({ action: AuditAction.automation_run_started, runId });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let stepName = "launch_browser";

  try {
    const credentials = await getTargetCredentials();

    stepName = "login";
    await loginToTargetSite(page, credentials);

    stepName = "navigate_to_reports";
    await navigateToReports(page);

    stepName = "apply_report_filters";
    await applyReportFilters(page, {
      from: run.dateFrom,
      to: run.dateTo,
      timezone: run.timezone
    });

    stepName = "extract_report_rows";
    const rows = await extractReportRows(page);
    await db.automationRun.update({
      where: { id: runId },
      data: { totalRowsFound: rows.length }
    });

    for (const row of rows) {
      stepName = `process_report_row:${row.reportRowKey}`;
      await processReportRow({ context, reportPage: page, runId, row, credentials }).catch(async (error) => {
        const message = error instanceof Error ? error.message : "Unknown care log processing error";
        logError("Care log processing failed", { runId, reportRowKey: row.reportRowKey, message });
        await db.careLogItem.upsert({
          where: { reportRowKey_careLogDate: { reportRowKey: row.reportRowKey, careLogDate: row.careLogDate } },
          update: {
            runId,
            clientName: row.clientName,
            sourceUrl: row.sourceUrl ?? page.url(),
            clientSigned: row.clientSigned,
            caregiverSigned: row.caregiverSigned,
            status: CareLogStatus.failed,
            errorStep: stepName,
            errorMessage: message,
            currentUrlOnError: page.url()
          },
          create: {
            runId,
            clientName: row.clientName,
            careLogDate: row.careLogDate,
            reportRowKey: row.reportRowKey,
            sourceUrl: row.sourceUrl ?? page.url(),
            clientSigned: row.clientSigned,
            caregiverSigned: row.caregiverSigned,
            status: CareLogStatus.failed,
            errorStep: stepName,
            errorMessage: message,
            currentUrlOnError: page.url()
          }
        });
      });
    }

    const grouped = await db.careLogItem.groupBy({
      by: ["status"],
      where: { runId },
      _count: true
    });
    const count = (status: CareLogStatus) => grouped.find((item) => item.status === status)?._count ?? 0;

    await db.automationRun.update({
      where: { id: runId },
      data: {
        status: AutomationRunStatus.completed,
        completedAt: new Date(),
        skippedCount: count(CareLogStatus.skipped),
        readyForReviewCount: count(CareLogStatus.ready_for_review),
        signedCount: count(CareLogStatus.signed),
        failedCount: count(CareLogStatus.failed)
      }
    });

    await writeAuditLog({ action: AuditAction.automation_run_completed, runId, metadata: { status: "completed" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown automation error";
    const screenshotPath = path.join("automation-artifacts", `${runId}-${Date.now()}.png`);
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true }).catch(() => undefined);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    await saveRunError(runId, stepName, message, page.url(), screenshotPath);
    throw error;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
