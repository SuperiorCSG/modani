import { chromium } from "playwright";
import { resolveDateRange } from "./dateRange.js";

function selectorError(section, key) {
  return new Error(`Missing selector: ${section}.${key}`);
}

function pick(selectors, section, key) {
  const value = selectors?.[section]?.[key];
  if (!value) {
    throw selectorError(section, key);
  }
  return value;
}

async function selectOrFill(locator, value) {
  try {
    await locator.selectOption({ label: value });
  } catch {
    try {
      await locator.selectOption(value);
    } catch {
      await locator.fill(value);
    }
  }
}

async function isPositiveMark(locator) {
  if ((await locator.count()) === 0) {
    return false;
  }

  const raw = await locator.first().evaluate((node) => {
    const aria = node.getAttribute("aria-checked") || node.getAttribute("aria-label");
    const data = node.getAttribute("data-value") || node.getAttribute("data-status");
    const text = node.textContent || "";
    const classes = node.getAttribute("class") || "";
    return `${aria || ""} ${data || ""} ${text} ${classes}`.toLowerCase();
  });

  return ["true", "yes", "checked", "complete", "completed", "signed", "tick", "check"].some(
    (token) => raw.includes(token)
  );
}

async function tasksAreComplete(page, selectors) {
  const taskRows = page.locator(pick(selectors, "careLog", "taskRows"));
  const taskCount = await taskRows.count();
  if (taskCount === 0) {
    return false;
  }

  const completedValues = selectors.careLog.completedValues || [];
  for (let index = 0; index < taskCount; index += 1) {
    const status = taskRows.nth(index).locator(pick(selectors, "careLog", "taskStatus"));
    if ((await status.count()) === 0) {
      return false;
    }

    const raw = await status.first().evaluate((node) => {
      const aria = node.getAttribute("aria-checked") || node.getAttribute("aria-label");
      const data = node.getAttribute("data-value") || node.getAttribute("data-status");
      const text = node.textContent || "";
      const classes = node.getAttribute("class") || "";
      return `${aria || ""} ${data || ""} ${text} ${classes}`.toLowerCase();
    });

    if (!completedValues.some((value) => raw.includes(String(value).toLowerCase()))) {
      return false;
    }
  }

  return true;
}

async function signCareLog(page, selectors) {
  await page.locator(pick(selectors, "careLog", "signButton")).first().click();
  const popup = page.locator(pick(selectors, "careLog", "popup")).first();
  await popup.waitFor();

  const managerName = (
    await popup.locator(pick(selectors, "careLog", "managerNameLine")).first().innerText()
  ).trim();

  await popup
    .locator(pick(selectors, "careLog", "signatureField"))
    .first()
    .fill(`// ${managerName} //`);
  await popup.locator(pick(selectors, "careLog", "submitSignature")).first().click();
}

export async function runUnsignedCareLogAutomation({
  settings,
  requestedRange,
  log = () => {},
  browserType = chromium
}) {
  if (!settings.targetUrl || !settings.username || !settings.password) {
    throw new Error("Target URL, username, and password must be configured before running.");
  }

  const selectors = settings.selectors;
  const dateRange = resolveDateRange(requestedRange);
  const summary = {
    dateRange,
    scannedReports: 0,
    openedCareLogs: 0,
    skippedIncompleteTasks: 0,
    signedCareLogs: 0
  };

  log(`Launching browser for ${settings.targetUrl}.`);
  const browser = await browserType.launch({
    headless: settings.headless !== false
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(Number(settings.timeoutMs) || 30000);

    log("Opening target website and signing in.");
    await page.goto(settings.targetUrl, { waitUntil: "domcontentloaded" });
    await page.locator(pick(selectors, "login", "username")).fill(settings.username);
    await page.locator(pick(selectors, "login", "password")).fill(settings.password);
    await page.locator(pick(selectors, "login", "submit")).click();

    log("Opening report section.");
    await page.locator(pick(selectors, "navigation", "reportsTab")).click();

    log(`Applying filters for ${dateRange.fromDate} through ${dateRange.toDate}.`);
    await selectOrFill(
      page.locator(pick(selectors, "reportFilters", "reportType")),
      selectors.reportFilters.reportTypeValue
    );
    await selectOrFill(page.locator(pick(selectors, "reportFilters", "fromDate")), dateRange.fromDate);
    await selectOrFill(page.locator(pick(selectors, "reportFilters", "toDate")), dateRange.toDate);
    await selectOrFill(
      page.locator(pick(selectors, "reportFilters", "groupBy")),
      selectors.reportFilters.groupByValue
    );
    await selectOrFill(
      page.locator(pick(selectors, "reportFilters", "client")),
      selectors.reportFilters.allClientsValue
    );
    await page.locator(pick(selectors, "reportFilters", "runReport")).click();

    const rows = page.locator(pick(selectors, "results", "rows"));
    const rowCount = await rows.count();
    log(`Found ${rowCount} report rows.`);

    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      summary.scannedReports += 1;
      const clientSigned = await isPositiveMark(row.locator(pick(selectors, "results", "clientSigned")));
      const caregiverSigned = await isPositiveMark(row.locator(pick(selectors, "results", "caregiverSigned")));

      if (!clientSigned || !caregiverSigned) {
        log(`Skipping row ${index + 1}; required signatures are not both checked.`);
        continue;
      }

      const notSignedLink = row.locator(pick(selectors, "results", "notSignedLink")).first();
      if ((await notSignedLink.count()) === 0) {
        log(`Skipping row ${index + 1}; no Not Signed link was found.`);
        continue;
      }

      const [careLogPage] = await Promise.all([
        page.waitForEvent("popup").catch(() => null),
        notSignedLink.click()
      ]);
      const activeCareLogPage = careLogPage || page;
      summary.openedCareLogs += 1;
      await activeCareLogPage.waitForLoadState("domcontentloaded").catch(() => {});

      if (!(await tasksAreComplete(activeCareLogPage, selectors))) {
        summary.skippedIncompleteTasks += 1;
        log(`Skipping care log from row ${index + 1}; at least one task is incomplete.`);
        if (careLogPage) {
          await careLogPage.close();
        }
        continue;
      }

      await signCareLog(activeCareLogPage, selectors);
      summary.signedCareLogs += 1;
      log(`Signed care log from row ${index + 1}.`);
      if (careLogPage) {
        await careLogPage.close();
      }
    }

    log(`Run complete: signed ${summary.signedCareLogs} care logs.`);
    return summary;
  } finally {
    await browser.close();
  }
}
