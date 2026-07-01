import type { Locator, Page } from "playwright";

export const selectors = {
  login: {
    username: [
      'input[name="username"]',
      'input#id_username',
      'input[type="email"]',
      'input[autocomplete="username"]'
    ],
    password: [
      'input[name="password"]',
      'input#id_password',
      'input[type="password"]',
      'input[autocomplete="current-password"]'
    ],
    continueButtons: ["#id_btn_sso", 'input[value="Continue"]'],
    loginButtons: ["#id_btn_signin", 'input[value="Login"]'],
    submitText: [/^login$/i, /^sign in$/i, /^continue$/i]
  },
  navigation: {
    reportsLink: ['a[href="/reports/"]', 'a[href="/reports"]'],
    reportsText: [/reports/i, /report center/i],
    unsignedCareLogsText: [/unsigned care logs/i]
  },
  reports: {
    reportTypeSelect: "#report_type",
    unsignedCareLogsValue: "/reports/unsignedcarelogs/",
    locationSelect: "#id_location",
    periodSelect: "#id_period",
    fromDateInput: "#id_from_",
    toDateInput: "#id_to_",
    groupByClientRadio: "#id_group_by_0",
    groupByCaregiverRadio: "#id_group_by_1",
    selectAllClientsCheckbox: "#id_select_all",
    runReportButton: '#show-report, input[value="Run Report"], input[type="submit"]',
    reportContainer: "#carelog_report",
    reportTables: "#carelog_report table",
    reportTypeLabels: [/report type/i],
    periodLabels: [/period/i, /date range/i],
    fromDateLabels: [/from/i, /start date/i],
    toDateLabels: [/to/i, /end date/i],
    groupByLabels: [/group by/i],
    clientLabels: [/client/i],
    runButtonText: [/^run report$/i, /^run$/i, /^search$/i],
    resultRows: ["#carelog_report table", "table tbody tr", "[role='row']"],
    notSignedLinkText: [/not signed/i]
  },
  careLog: {
    taskPanels: [".tasks"],
    taskTables: [".tasks table.tasklog-data", "table.tasklog-data"],
    taskRows: ["table.tasklog-data tr", "[data-task-row]", ".task-row", "[role='row']"],
    taskName: ["a.link_no_color", "[data-task-name]", ".task-name"],
    signatureLinks: ["a.caremanager-signature"],
    signatureDialog: [".ui-dialog:has-text('Sign This Care Log')", "[role='dialog']:has-text('Sign This Care Log')"],
    signatureButtons: [/^sign$/i, /add sign/i, /sign as care manager/i],
    signatureInputLabels: [/signature/i, /sign here/i],
    submitSignatureText: [/^sign$/i, /submit/i, /save/i]
  }
} as const;

export async function firstVisible(page: Page, candidates: readonly string[]): Promise<Locator> {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  throw new Error(`No visible selector found from candidates: ${candidates.join(", ")}`);
}

export async function clickByText(page: Page, candidates: readonly RegExp[]): Promise<void> {
  for (const candidate of candidates) {
    const link = page.getByRole("link", { name: candidate }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      return;
    }

    const button = page.getByRole("button", { name: candidate }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }

    const text = page.getByText(candidate).first();
    if (await text.isVisible().catch(() => false)) {
      await text.click();
      return;
    }
  }
  throw new Error(`Could not find clickable text for: ${candidates.map(String).join(", ")}`);
}
