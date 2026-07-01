import type { Page } from "playwright";
import { formatInTimeZone } from "date-fns-tz";
import { selectors } from "@/automation/selectors";
import type { DateRange } from "@/automation/types";

async function fillByLabel(page: Page, labels: readonly RegExp[], value: string): Promise<boolean> {
  for (const label of labels) {
    const field = page.getByLabel(label).first();
    if (await field.isVisible().catch(() => false)) {
      await field.fill(value);
      return true;
    }
  }
  return false;
}

async function selectByLabel(page: Page, labels: readonly RegExp[], value: string): Promise<boolean> {
  for (const label of labels) {
    const field = page.getByLabel(label).first();
    if (await field.isVisible().catch(() => false)) {
      await field.selectOption({ label: value }).catch(async () => field.fill(value));
      return true;
    }
  }
  return false;
}

export async function applyReportFilters(page: Page, range: DateRange): Promise<void> {
  await selectByLabel(page, selectors.reports.reportTypeLabels, "Unsigned Care Logs");
  await selectByLabel(page, selectors.reports.periodLabels, "Custom");

  const from = formatInTimeZone(range.from, range.timezone, "MM/dd/yyyy");
  const to = formatInTimeZone(range.to, range.timezone, "MM/dd/yyyy");

  if (!(await fillByLabel(page, selectors.reports.fromDateLabels, from))) {
    throw new Error("Report from-date field not found");
  }

  if (!(await fillByLabel(page, selectors.reports.toDateLabels, to))) {
    throw new Error("Report to-date field not found");
  }

  await selectByLabel(page, selectors.reports.groupByLabels, "State Client");
  await selectByLabel(page, selectors.reports.clientLabels, "All Clients");

  for (const text of selectors.reports.runButtonText) {
    const button = page.getByRole("button", { name: text }).first();
    if (await button.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("networkidle").catch(() => undefined),
        button.click()
      ]);
      return;
    }
  }

  throw new Error("Run Report button not found");
}
