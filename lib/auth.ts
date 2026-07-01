import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEnv } from "@/lib/env";

const SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  adminId: string;
  issuedAt: number;
};

function sign(value: string): string {
  return crypto.createHmac("sha256", requireEnv("SESSION_SECRET")).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature || sign(body) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.issuedAt;
    if (!payload.adminId || ageSeconds > SESSION_TTL_SECONDS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function verifyAdminCredentials(email: string, password: string) {
  const admin = await db.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin || admin.status !== "active") {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  return passwordMatches ? admin : null;
}

export function setSessionCookie(response: NextResponse, adminId: string): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: encodeSession({ adminId, issuedAt: Math.floor(Date.now() / 1000) }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = token ? decodeSession(token) : null;
  if (!payload) {
    return null;
  }

  const admin = await db.admin.findUnique({
    where: { id: payload.adminId },
    select: { id: true, email: true, name: true, status: true }
  });

  return admin?.status === "active" ? admin : null;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error("Unauthorized");
  }
  return admin;
}

export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
