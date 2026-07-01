import type { BrowserContext, Page } from "playwright";
import { selectors } from "@/automation/selectors";
import type { ReportRow } from "@/automation/types";

async function expandMatchingCareLog(page: Page, row: ReportRow): Promise<void> {
  const careLogId = row.sourceUrl?.match(/\/carelog\/(\d+)/)?.[1];
  if (careLogId) {
    const panel = page.locator(`.tasks:has(a.edit-carelog[href*="/${careLogId}/"])`).first();
    if ((await panel.count()) > 0 && !(await panel.isVisible().catch(() => false))) {
      await panel.evaluate((element) => {
        if (element.previousElementSibling instanceof HTMLElement) {
          element.previousElementSibling.click();
        }
      });
      await page.waitForTimeout(500);
      return;
    }
  }

  const time = row.activityLabel?.match(/\b(\d{1,2}:\d{2})\s*(AM|PM)\b/i);
  if (time) {
    const label = `${time[1]}${time[2]}`.toLowerCase();
    const header = page
      .locator(".day_schedule > h3, .ui-accordion-header")
      .filter({ hasText: new RegExp(label.replace(":", ":\\s*"), "i") })
      .first();
    if ((await header.count()) > 0) {
      await header.click();
      await page.waitForTimeout(500);
    }
  }
}

export async function openCareLog(context: BrowserContext, reportPage: Page, row: ReportRow): Promise<Page> {
  if (row.sourceUrl) {
    const page = await context.newPage();
    await page.goto(row.sourceUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.locator(".day_schedule, .tasks, table.tasklog-data").first().waitFor({ state: "attached", timeout: 30_000 }).catch(() => undefined);
    await expandMatchingCareLog(page, row);
    return page;
  }

  const link = reportPage.getByRole("link", { name: selectors.reports.notSignedLinkText[0] }).first();
  if (!(await link.isVisible().catch(() => false))) {
    throw new Error("Not Signed link not found");
  }

  const newPagePromise = context.waitForEvent("page", { timeout: 10_000 }).catch(() => null);
  await link.click();
  const newPage = await newPagePromise;
  const page = newPage ?? reportPage;
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.locator(".day_schedule, .tasks, table.tasklog-data").first().waitFor({ state: "attached", timeout: 30_000 }).catch(() => undefined);
  await expandMatchingCareLog(page, row);
  return page;
}
