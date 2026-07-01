import type { Locator, Page } from "playwright";
import { selectors } from "@/automation/selectors";
import type { CareLogTaskSnapshot } from "@/automation/types";

function isCheckedStatus(text: string, imageSources: string[]): boolean {
  if (imageSources.some((src) => /close\.png|cross|x\.png|incomplete|missed/i.test(src))) {
    return false;
  }
  if (imageSources.some((src) => /check\.png|checked|tick/i.test(src))) {
    return true;
  }
  return /checked|completed|done|yes|✓|✔/i.test(text) && !/cross|missed|missing|incomplete|not done|refused|✕|✖|\bx\b/i.test(text);
}

async function taskFromRow(row: Locator): Promise<CareLogTaskSnapshot | null> {
  const text = (await row.innerText().catch(() => "")).trim();
  if (!text || (/task|status/i.test(text) && text.length < 20)) {
    return null;
  }

  const cells = row.locator("td");
  if ((await cells.count()) >= 3) {
    const taskTime = (await cells.nth(0).innerText()).trim();
    const taskName = (await cells.nth(1).innerText()).replace(/^\s*X\s*/i, "").replace(/\s+/g, " ").trim();
    const statusCell = cells.nth(2);
    const imageSources = await statusCell.locator("img").evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).src)
    );
    const statusText = (await statusCell.innerText().catch(() => "")).trim();

    if (!taskName || /^task$/i.test(taskName) || /description/i.test(taskName) || !/\d{1,2}:\d{2}/.test(taskTime)) {
      return null;
    }

    return {
      taskTime,
      taskName,
      statusLabel: imageSources.length > 0 ? imageSources.map((src) => src.split("/").pop()).join(", ") : statusText || "missing",
      isChecked: isCheckedStatus(statusText, imageSources)
    };
  }

  const time = text.match(/\b\d{1,2}:\d{2}\s?(?:a\.m\.|p\.m\.|am|pm)?\b/i)?.[0];
  const taskName =
    (await row.locator(selectors.careLog.taskName.join(",")).first().innerText().catch(() => "")) ||
    text.replace(/\s+/g, " ").replace(/^\s*X\s*/i, "").trim();
  const imageSources = await row.locator("img").evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  const imageAlt = await row.locator("img").first().getAttribute("alt").catch(() => null);
  const ariaLabel = await row.locator("[aria-label]").first().getAttribute("aria-label").catch(() => null);
  const statusLabel = [imageAlt, ariaLabel, imageSources.map((src) => src.split("/").pop()).join(", "), text].filter(Boolean).join(" ");

  return {
    taskTime: time,
    taskName: taskName.trim(),
    statusLabel: statusLabel.trim(),
    isChecked: isCheckedStatus(statusLabel, imageSources)
  };
}

function careLogIdFromUrl(url: string): string | null {
  return url.match(/\/carelog\/(\d+)/)?.[1] ?? url.match(/\/edit-carelog\/(\d+)/)?.[1] ?? null;
}

async function taskScope(page: Page): Promise<Locator> {
  const careLogId = careLogIdFromUrl(page.url());
  if (careLogId) {
    const matchingPanel = page.locator(`.tasks:has(a.edit-carelog[href*="/${careLogId}/"])`).first();
    if ((await matchingPanel.count()) > 0) {
      return matchingPanel;
    }
  }

  const activePanel = page.locator(".tasks.ui-accordion-content-active").first();
  if ((await activePanel.count()) > 0) {
    return activePanel;
  }

  return page.locator("body");
}

async function linkTasksFromTargetPanel(page: Page): Promise<CareLogTaskSnapshot[]> {
  const careLogId = careLogIdFromUrl(page.url());
  const rawTasks = await page.evaluate((id) => {
    const panels = Array.from(document.querySelectorAll(".tasks"));
    const panel =
      (id ? panels.find((candidate) => candidate.querySelector(`a.edit-carelog[href*="/${id}/"]`)) : null) ??
      panels.find((candidate) => candidate.className.includes("ui-accordion-content-active"));

    if (!panel) {
      return [];
    }

    return Array.from(panel.querySelectorAll("a.link_no_color"))
      .map((link) => {
        const row = link.closest("tr");
        const cells = row ? Array.from(row.querySelectorAll("td")) : [];
        const taskTime = cells[0]?.textContent?.trim();
        const statusCell = cells[cells.length - 1];
        const imageSources = statusCell
          ? Array.from(statusCell.querySelectorAll("img")).map((image) => (image as HTMLImageElement).src)
          : [];
        const statusText = statusCell?.textContent?.trim() ?? "";
        const taskName = link.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return { taskTime, taskName, statusText, imageSources };
      })
      .filter((task) => task.taskName && /\d{1,2}:\d{2}/.test(task.taskTime ?? ""));
  }, careLogId);

  return rawTasks.map((task) => ({
    taskTime: task.taskTime,
    taskName: task.taskName,
    statusLabel: task.imageSources.length > 0 ? task.imageSources.map((src) => src.split("/").pop()).join(", ") : task.statusText || "missing",
    isChecked: isCheckedStatus(task.statusText, task.imageSources)
  }));
}

export async function extractCareLogTasks(page: Page): Promise<CareLogTaskSnapshot[]> {
  const panelLinkTasks = await linkTasksFromTargetPanel(page);
  if (panelLinkTasks.length > 0) {
    return panelLinkTasks;
  }

  const scope = await taskScope(page);
  const taskTable = scope.locator(selectors.careLog.taskTables.join(",")).first();
  const rows = (await taskTable.count()) > 0 ? taskTable.locator("tr") : scope.locator(selectors.careLog.taskRows.join(","));
  const count = await rows.count();
  const tasks: CareLogTaskSnapshot[] = [];

  for (let index = 0; index < count; index += 1) {
    const task = await taskFromRow(rows.nth(index));
    if (task) {
      tasks.push(task);
    }
  }

  const linkTasks = await scope.locator("a.link_no_color").evaluateAll((links) =>
    links
      .map((link) => {
        const row = link.closest("tr");
        const cells = row ? Array.from(row.querySelectorAll("td")) : [];
        const taskTime = cells[0]?.textContent?.trim();
        const statusCell = cells[cells.length - 1];
        const imageSources = statusCell
          ? Array.from(statusCell.querySelectorAll("img")).map((image) => (image as HTMLImageElement).src)
          : [];
        const statusText = statusCell?.textContent?.trim() ?? "";
        const taskName = link.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return { taskTime, taskName, statusText, imageSources };
      })
      .filter((task) => task.taskName && /\d{1,2}:\d{2}/.test(task.taskTime ?? ""))
  );

  if (linkTasks.length > tasks.length) {
    return linkTasks.map((task) => ({
      taskTime: task.taskTime,
      taskName: task.taskName,
      statusLabel: task.imageSources.length > 0 ? task.imageSources.map((src) => src.split("/").pop()).join(", ") : task.statusText || "missing",
      isChecked: isCheckedStatus(task.statusText, task.imageSources)
    }));
  }

  if (tasks.length === 0) {
    throw new Error("Task list not readable");
  }

  return tasks;
}
