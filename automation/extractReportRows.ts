import type { Locator, Page } from "playwright";
import { selectors } from "@/automation/selectors";
import type { ReportRow } from "@/automation/types";

function parseCareLogDate(value: string): Date {
  const normalized = value.trim();
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.valueOf())) {
    return parsed;
  }

  const match = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) {
    throw new Error(`Unable to parse care log date: ${value}`);
  }

  return new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2])));
}

async function readCellTexts(row: Locator): Promise<string[]> {
  const cells = row.locator("th,td,[role='cell'],[role='gridcell']");
  const count = await cells.count();
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push((await cells.nth(index).innerText()).trim());
  }
  return values;
}

function checkedFromText(value: string): boolean {
  return /yes|signed|checked|complete|✓|✔|true/i.test(value) && !/not|unsigned|missing|no|✕|x/i.test(value);
}

async function cellHasCheck(cell: Locator): Promise<boolean> {
  const imageSources = await cell.locator("img").evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).src.toLowerCase())
  );
  if (imageSources.some((src) => /check\.png|checked|tick/.test(src))) {
    return true;
  }
  if (imageSources.some((src) => /close\.png|cross|x\.png/.test(src))) {
    return false;
  }
  return checkedFromText(await cell.innerText().catch(() => ""));
}

async function clientNameForReportTable(table: Locator): Promise<string> {
  return table.evaluate((element) => {
    let node = element.previousElementSibling;
    while (node) {
      if (node.tagName.toLowerCase() === "h3" && node.textContent?.trim()) {
        return node.textContent.trim();
      }
      node = node.previousElementSibling;
    }
    return "Unknown client";
  });
}

async function extractClearCareReportTables(page: Page): Promise<ReportRow[]> {
  const tables = page.locator(selectors.reports.reportTables);
  const count = await tables.count();
  const rows: ReportRow[] = [];

  for (let index = 0; index < count; index += 1) {
    const table = tables.nth(index);
    const summaryRow = table.locator("tr").nth(1);
    const cells = summaryRow.locator("td");
    if ((await cells.count()) < 5) {
      continue;
    }

    const dateText = (await cells.nth(0).innerText()).trim();
    const activityText = (await cells.nth(1).innerText()).replace(/\s+/g, " ").trim();
    const clientSigned = await cellHasCheck(cells.nth(2));
    const caregiverSigned = await cellHasCheck(cells.nth(3));
    const notSignedLink = cells.nth(4).getByRole("link", { name: selectors.reports.notSignedLinkText[0] }).first();
    const href = await notSignedLink.getAttribute("href").catch(() => null);
    const clientName = await clientNameForReportTable(table);
    const sourceUrl = href ? new URL(href, page.url()).toString() : page.url();

    rows.push({
      reportRowKey: href ?? `${clientName}:${dateText}:${activityText}:${index}`,
      clientName,
      careLogDate: parseCareLogDate(dateText),
      sourceUrl,
      activityLabel: activityText,
      clientSigned,
      caregiverSigned,
      notSignedLabel: await notSignedLink.innerText().catch(() => undefined)
    });
  }

  return rows;
}

export async function extractReportRows(page: Page): Promise<ReportRow[]> {
  const clearCareRows = await extractClearCareReportTables(page);
  if (clearCareRows.length > 0) {
    return clearCareRows;
  }

  const rows = page.locator(selectors.reports.resultRows.join(",")).filter({ hasText: /signed|not signed|client/i });
  const count = await rows.count();
  const reportRows: ReportRow[] = [];

  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const cellTexts = await readCellTexts(row);
    if (cellTexts.length < 2 || /client signed/i.test(cellTexts.join(" "))) {
      continue;
    }

    const notSignedLink = row.getByRole("link", { name: selectors.reports.notSignedLinkText[0] }).first();
    const href = await notSignedLink.getAttribute("href").catch(() => null);
    const rowText = cellTexts.join(" | ");
    const clientName = cellTexts.find((cell) => /[a-z]/i.test(cell) && !/signed|not signed|yes|no/i.test(cell)) ?? "Unknown client";
    const dateText = cellTexts.find((cell) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cell)) ?? "";

    reportRows.push({
      reportRowKey: `${clientName}:${dateText}:${index}`,
      clientName,
      careLogDate: parseCareLogDate(dateText),
      sourceUrl: href ? new URL(href, page.url()).toString() : undefined,
      activityLabel: rowText,
      clientSigned: /client signed[:\s|]+(yes|signed|checked|✓|✔)/i.test(rowText) || checkedFromText(cellTexts.at(-2) ?? ""),
      caregiverSigned:
        /caregiver signed[:\s|]+(yes|signed|checked|✓|✔)/i.test(rowText) || checkedFromText(cellTexts.at(-1) ?? ""),
      notSignedLabel: await notSignedLink.innerText().catch(() => undefined)
    });
  }

  return reportRows;
}
