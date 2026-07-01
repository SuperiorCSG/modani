import type { Page } from "playwright";
import { selectors } from "@/automation/selectors";

export async function navigateToReports(page: Page): Promise<void> {
  const reportsLink = page.getByRole("link", { name: "Reports" }).first();
  if (await reportsLink.isVisible().catch(() => false)) {
    await reportsLink.click();
  } else {
    await page.locator(selectors.navigation.reportsLink.join(",")).first().click();
  }
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);

  const reportType = page.locator(selectors.reports.reportTypeSelect).first();
  if (await reportType.isVisible().catch(() => false)) {
    await reportType.selectOption(selectors.reports.unsignedCareLogsValue);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForSelector(selectors.reports.fromDateInput, { state: "attached", timeout: 10_000 }).catch(() => undefined);
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (!/unsigned care logs|report type/i.test(bodyText)) {
    throw new Error("Report page not found");
  }
}
