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

async function waitForReportGeneration(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const bodyText = document.body.innerText;
        return (
          document.querySelectorAll("#carelog_report table").length > 0 ||
          /no report rows|no results|no records/i.test(bodyText) ||
          (!/generating report/i.test(bodyText) && document.querySelector("#report_container"))
        );
      },
      undefined,
      { timeout: 120_000 }
    )
    .catch(() => undefined);
}

export async function applyReportFilters(page: Page, range: DateRange): Promise<void> {
  const reportType = page.locator(selectors.reports.reportTypeSelect).first();
  if (await reportType.isVisible().catch(() => false)) {
    await reportType.selectOption(selectors.reports.unsignedCareLogsValue);
    await page.waitForSelector(selectors.reports.fromDateInput, { state: "attached", timeout: 10_000 }).catch(() => undefined);
  } else {
    await selectByLabel(page, selectors.reports.reportTypeLabels, "Unsigned Care Logs");
  }

  const from = formatInTimeZone(range.from, range.timezone, "MM/dd/yyyy");
  const to = formatInTimeZone(range.to, range.timezone, "MM/dd/yyyy");

  const fromField = page.locator(selectors.reports.fromDateInput).first();
  if ((await fromField.count()) > 0) {
    await fromField.fill(from);
  } else if (!(await fillByLabel(page, selectors.reports.fromDateLabels, from))) {
    throw new Error("Report from-date field not found");
  }

  const toField = page.locator(selectors.reports.toDateInput).first();
  if ((await toField.count()) > 0) {
    await toField.fill(to);
  } else if (!(await fillByLabel(page, selectors.reports.toDateLabels, to))) {
    throw new Error("Report to-date field not found");
  }

  const groupByClient = page.locator(selectors.reports.groupByClientRadio).first();
  if (await groupByClient.isVisible().catch(() => false)) {
    await groupByClient.check();
  } else {
    await selectByLabel(page, selectors.reports.groupByLabels, "Client");
  }

  const selectAllClients = page.locator(selectors.reports.selectAllClientsCheckbox).first();
  if ((await selectAllClients.count()) > 0) {
    await selectAllClients.check({ force: true });
  } else {
    await selectByLabel(page, selectors.reports.clientLabels, "All Clients");
  }

  const runReport = page.locator(selectors.reports.runReportButton).first();
  if ((await runReport.count()) > 0) {
    await Promise.all([
      page.waitForLoadState("networkidle").catch(() => undefined),
      runReport.click({ force: true })
    ]);
    await waitForReportGeneration(page);
    return;
  }

  for (const text of selectors.reports.runButtonText) {
    const button = page.getByRole("button", { name: text }).first();
    if (await button.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("networkidle").catch(() => undefined),
        button.click()
      ]);
      await waitForReportGeneration(page);
      return;
    }
  }

  throw new Error("Run Report button not found");
}
