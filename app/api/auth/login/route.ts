import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, verifyAdminCredentials } from "@/lib/auth";
import { writeAuditLog } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const admin = await verifyAdminCredentials(email, password);

  if (!admin) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  setSessionCookie(response, admin.id);
  await writeAuditLog({
    action: AuditAction.admin_login,
    adminId: admin.id,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined
  });
  return response;
}
