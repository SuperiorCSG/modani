import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const formData = await request.formData();
    const targetUrl = String(formData.get("targetUrl") ?? "");
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const signatureTemplate = String(formData.get("signatureTemplate") ?? "// {{careManagerName}} //");
    const captureSnapshots = formData.get("captureSnapshots") === "on";
    const existing = await db.targetSiteCredential.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!existing && !password) {
      return NextResponse.redirect(new URL("/settings?error=missing-password", request.url), 303);
    }

    const encrypted = password
      ? encryptSecret(password)
      : {
          encryptedText: existing!.encryptedPassword,
          iv: existing!.passwordIv,
          authTag: existing!.passwordAuthTag
        };

    await db.targetSiteCredential.upsert({
      where: { id: existing?.id ?? "new" },
      update: {
        targetUrl,
        username,
        encryptedPassword: encrypted.encryptedText,
        passwordIv: encrypted.iv,
        passwordAuthTag: encrypted.authTag,
        signatureTemplate,
        captureSnapshots,
        updatedByAdminId: admin.id
      },
      create: {
        targetUrl,
        username,
        encryptedPassword: encrypted.encryptedText,
        passwordIv: encrypted.iv,
        passwordAuthTag: encrypted.authTag,
        signatureTemplate,
        captureSnapshots,
        updatedByAdminId: admin.id
      }
    });

    await writeAuditLog({
      action: AuditAction.credentials_updated,
      adminId: admin.id,
      metadata: { targetUrl, username, captureSnapshots }
    });

    return NextResponse.redirect(new URL("/settings?saved=1", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/settings?error=1", request.url), 303);
  }
}
