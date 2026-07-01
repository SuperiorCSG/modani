import { chromium, type Page } from "playwright";
import { AuditAction, CareLogStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/logger";
import { loginToTargetSite } from "@/automation/loginToTargetSite";
import { selectors } from "@/automation/selectors";

function extractCareManagerName(text: string): string {
  const loginMatch = text.match(/You are logged in as\s+(.+?)\./i);
  if (loginMatch?.[1]) {
    return loginMatch[1].trim();
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Care manager name not found in signature popup");
  }
  return lines[lines.length - 2];
}

function renderSignature(template: string, careManagerName: string): string {
  return template.replaceAll("{{careManagerName}}", careManagerName);
}

function careLogIdFromUrl(url: string): string | null {
  return url.match(/\/carelog\/(\d+)/)?.[1] ?? url.match(/\/edit-carelog\/(\d+)/)?.[1] ?? null;
}

async function expandCareLogPanel(page: Page, sourceUrl: string) {
  const careLogId = careLogIdFromUrl(sourceUrl);
  if (!careLogId) {
    return page.locator("body");
  }

  const panel = page.locator(`.tasks:has(a.edit-carelog[href*="/${careLogId}/"])`).first();
  if ((await panel.count()) === 0) {
    return page.locator("body");
  }

  if (!(await panel.isVisible().catch(() => false))) {
    await panel.evaluate((element) => {
      if (element.previousElementSibling instanceof HTMLElement) {
        element.previousElementSibling.click();
      }
    });
    await page.waitForTimeout(300);
  }
  return panel;
}

async function getCredentials() {
  const credential = await db.targetSiteCredential.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!credential) {
    throw new Error("Target site credentials have not been configured");
  }

  return {
    targetUrl: credential.targetUrl,
    username: credential.username,
    password: decryptSecret({
      encryptedText: credential.encryptedPassword,
      iv: credential.passwordIv,
      authTag: credential.passwordAuthTag
    }),
    signatureTemplate: credential.signatureTemplate,
    captureSnapshots: credential.captureSnapshots
  };
}

export async function approveAndSignCareLog(input: {
  careLogItemId: string;
  approvingAdminId: string;
}): Promise<void> {
  const credentials = await getCredentials();
  const item = await db.careLogItem.findUnique({ where: { id: input.careLogItemId } });
  if (!item) {
    throw new Error("Care log item not found");
  }
  if (item.status !== CareLogStatus.approved && item.status !== CareLogStatus.ready_for_review) {
    throw new Error("Only approved or ready-for-review care logs can be signed");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginToTargetSite(page, credentials);
    await page.goto(item.sourceUrl, { waitUntil: "domcontentloaded" });

    const scope = await expandCareLogPanel(page, item.sourceUrl);

    for (const selector of selectors.careLog.signatureLinks) {
      const clickable = scope.locator(selector).first();
      if (await clickable.isVisible().catch(() => false)) {
        await clickable.click();
        const dialog = page.locator(".ui-dialog").filter({ hasText: "Sign This Care Log" }).last();
        await dialog.waitFor({ state: "visible", timeout: 10_000 });
        const popupText = await dialog.innerText();
        const careManagerName = extractCareManagerName(popupText);
        const signature = renderSignature(credentials.signatureTemplate, careManagerName);

        const inputField = dialog.locator('input[name="name"], input[type="text"], textarea').last();
        if (!(await inputField.isVisible().catch(() => false))) {
          throw new Error("Signature field not found");
        }
        await inputField.fill(signature);

        for (const submitText of selectors.careLog.submitSignatureText) {
          const submit = dialog.getByRole("button", { name: submitText }).first();
          if (await submit.isVisible().catch(() => false)) {
            await submit.click();
            await page.waitForLoadState("networkidle").catch(() => undefined);
            break;
          }
        }

        await db.careLogItem.update({
          where: { id: item.id },
          data: {
            status: CareLogStatus.signed,
            signedAt: new Date(),
            careManagerName
          }
        });
        await writeAuditLog({
          action: AuditAction.care_log_signed,
          adminId: input.approvingAdminId,
          careLogItemId: item.id,
          runId: item.runId,
          metadata: { careManagerName }
        });
        return;
      }
    }

    throw new Error("Add Sign or Sign as Care Manager button not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown signing error";
    await db.careLogItem.update({
      where: { id: item.id },
      data: {
        status: CareLogStatus.failed,
        errorStep: "approved_signing_flow",
        errorMessage: message,
        currentUrlOnError: page.url()
      }
    });
    await writeAuditLog({
      action: AuditAction.care_log_failed,
      adminId: input.approvingAdminId,
      careLogItemId: item.id,
      runId: item.runId,
      metadata: { step: "approved_signing_flow", message }
    });
    throw error;
  } finally {
    await browser.close();
  }
}
