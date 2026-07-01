import type { BrowserContext, Page } from "playwright";
import { selectors } from "@/automation/selectors";
import type { ReportRow } from "@/automation/types";

export async function openCareLog(context: BrowserContext, reportPage: Page, row: ReportRow): Promise<Page> {
  if (row.sourceUrl) {
    const page = await context.newPage();
    await page.goto(row.sourceUrl, { waitUntil: "domcontentloaded" });
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
  return page;
}
