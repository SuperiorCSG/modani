import { chromium } from "playwright";
import { AuditAction, CareLogStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/logger";
import { loginToTargetSite } from "@/automation/loginToTargetSite";
import { selectors } from "@/automation/selectors";

function extractCareManagerName(text: string): string {
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

    for (const text of selectors.careLog.signatureButtons) {
      const button = page.getByRole("button", { name: text }).first();
      const link = page.getByRole("link", { name: text }).first();
      const clickable = (await button.isVisible().catch(() => false)) ? button : link;
      if (await clickable.isVisible().catch(() => false)) {
        const popupPromise = context.waitForEvent("page", { timeout: 10_000 }).catch(() => null);
        await clickable.click();
        const popup = (await popupPromise) ?? page;
        await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
        const popupText = await popup.locator("body").innerText();
        const careManagerName = extractCareManagerName(popupText);
        const signature = renderSignature(credentials.signatureTemplate, careManagerName);

        let filled = false;
        for (const label of selectors.careLog.signatureInputLabels) {
          const inputField = popup.getByLabel(label).first();
          if (await inputField.isVisible().catch(() => false)) {
            await inputField.fill(signature);
            filled = true;
            break;
          }
        }

        if (!filled) {
          const inputField = popup.locator("input[type='text'], textarea").last();
          if (!(await inputField.isVisible().catch(() => false))) {
            throw new Error("Signature field not found");
          }
          await inputField.fill(signature);
        }

        for (const submitText of selectors.careLog.submitSignatureText) {
          const submit = popup.getByRole("button", { name: submitText }).first();
          if (await submit.isVisible().catch(() => false)) {
            await submit.click();
            await popup.waitForLoadState("networkidle").catch(() => undefined);
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
