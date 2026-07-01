import type { Page } from "playwright";
import { firstVisible, selectors } from "@/automation/selectors";
import type { TargetCredentials } from "@/automation/types";

export async function loginToTargetSite(page: Page, credentials: TargetCredentials): Promise<void> {
  await page.goto(credentials.targetUrl, { waitUntil: "domcontentloaded" });

  const username = await firstVisible(page, selectors.login.username);
  await username.fill(credentials.username);

  const password = await firstVisible(page, selectors.login.password);
  await password.fill(credentials.password);

  for (const text of selectors.login.submitText) {
    const button = page.getByRole("button", { name: text }).first();
    if (await button.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded").catch(() => undefined),
        button.click()
      ]);
      break;
    }

    const input = page.locator(`input[type="submit"][value*="${text.source.replace(/[^a-z ]/gi, "")}"]`).first();
    if (await input.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded").catch(() => undefined),
        input.click()
      ]);
      break;
    }
  }

  await page.waitForLoadState("networkidle").catch(() => undefined);

  const stillOnPasswordField = await page.locator(selectors.login.password.join(",")).first().isVisible().catch(() => false);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (stillOnPasswordField || /invalid|incorrect|try again|unable to log/i.test(bodyText)) {
    throw new Error("Target site login failed");
  }
}
