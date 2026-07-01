import type { Locator, Page } from "playwright";
import { selectors } from "@/automation/selectors";
import type { CareLogTaskSnapshot } from "@/automation/types";

function isCheckedStatus(text: string): boolean {
  return /checked|completed|done|yes|✓|✔/i.test(text) && !/cross|missed|missing|incomplete|not done|refused|✕|✖|\bx\b/i.test(text);
}

async function taskFromRow(row: Locator): Promise<CareLogTaskSnapshot | null> {
  const text = (await row.innerText().catch(() => "")).trim();
  if (!text || /task|status/i.test(text) && text.length < 20) {
    return null;
  }

  const time = text.match(/\b\d{1,2}:\d{2}\s?(?:am|pm)?\b/i)?.[0];
  const taskName =
    (await row.locator(selectors.careLog.taskName.join(",")).first().innerText().catch(() => "")) ||
    text.replace(/\s+/g, " ").trim();
  const imageAlt = await row.locator("img").first().getAttribute("alt").catch(() => null);
  const ariaLabel = await row.locator("[aria-label]").first().getAttribute("aria-label").catch(() => null);
  const statusLabel = [imageAlt, ariaLabel, text].filter(Boolean).join(" ");

  return {
    taskTime: time,
    taskName: taskName.trim(),
    statusLabel: statusLabel.trim(),
    isChecked: isCheckedStatus(statusLabel)
  };
}

export async function extractCareLogTasks(page: Page): Promise<CareLogTaskSnapshot[]> {
  const rows = page.locator(selectors.careLog.taskRows.join(","));
  const count = await rows.count();
  const tasks: CareLogTaskSnapshot[] = [];

  for (let index = 0; index < count; index += 1) {
    const task = await taskFromRow(rows.nth(index));
    if (task) {
      tasks.push(task);
    }
  }

  if (tasks.length === 0) {
    throw new Error("Task list not readable");
  }

  return tasks;
}
