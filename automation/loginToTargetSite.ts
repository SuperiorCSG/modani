import type { Page } from "playwright";
import { firstVisible, selectors } from "@/automation/selectors";
import type { TargetCredentials } from "@/automation/types";

async function clickFirstVisible(page: Page, candidates: readonly string[]): Promise<boolean> {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded").catch(() => undefined),
        locator.click()
      ]);
      return true;
    }
  }
  return false;
}

async function setSensitiveInputValue(page: Page, candidates: readonly string[], value: string): Promise<void> {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.evaluate(
        (element, secretValue) => {
          const input = element as HTMLInputElement;
          input.value = secretValue;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        },
        value
      );
      return;
    }
  }
  throw new Error("Visible password field not found");
}

export async function loginToTargetSite(page: Page, credentials: TargetCredentials): Promise<void> {
  await page.goto(credentials.targetUrl, { waitUntil: "domcontentloaded" });

  const username = await firstVisible(page, selectors.login.username);
  await username.fill(credentials.username);

  const passwordVisible = await page.locator(selectors.login.password.join(",")).first().isVisible().catch(() => false);
  if (!passwordVisible) {
    await clickFirstVisible(page, selectors.login.continueButtons);
    await page.locator(selectors.login.password.join(",")).first().waitFor({ state: "visible", timeout: 10_000 });
  }

  await setSensitiveInputValue(page, selectors.login.password, credentials.password);

  if (await clickFirstVisible(page, selectors.login.loginButtons)) {
    await page.waitForLoadState("networkidle").catch(() => undefined);
  } else {
    throw new Error("Target site login button not found");
  }

  const stillOnPasswordField = await page.locator(selectors.login.password.join(",")).first().isVisible().catch(() => false);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (stillOnPasswordField || /invalid|incorrect|try again|unable to log/i.test(bodyText)) {
    throw new Error("Target site login failed");
  }
}
