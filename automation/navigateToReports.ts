import type { Page } from "playwright";
import { clickByText, selectors } from "@/automation/selectors";

export async function navigateToReports(page: Page): Promise<void> {
  await clickByText(page, selectors.navigation.reportsText);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);

  const unsignedCareLogs = page.getByText(selectors.navigation.unsignedCareLogsText[0]).first();
  if (await unsignedCareLogs.isVisible().catch(() => false)) {
    await unsignedCareLogs.click();
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (!/unsigned care logs|report type/i.test(bodyText)) {
    throw new Error("Report page not found");
  }
}
