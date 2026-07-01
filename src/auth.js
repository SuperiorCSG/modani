import crypto from "node:crypto";
import cookieParser from "cookie-parser";
import { createAdmin, verifyAdmin } from "./store.js";

const COOKIE_NAME = "automation_admin";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function sessionSecret() {
  return process.env.SESSION_SECRET || "development-only-session-secret";
}

function sign(payload) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

function encodeSession() {
  const payload = JSON.stringify({
    role: "admin",
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  const body = Buffer.from(payload).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(value) {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(".");
  if (!body || !signature || sign(body) !== signature) {
    return null;
  }

  const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (session.role !== "admin" || session.expiresAt < Date.now()) {
    return null;
  }

  return session;
}

export function installAuth(app) {
  app.use(cookieParser());
  app.use((req, _res, next) => {
    req.adminSession = decodeSession(req.cookies?.[COOKIE_NAME]);
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (!req.adminSession) {
    res.status(401).json({ error: "Admin login required." });
    return;
  }
  next();
}

export async function setupAdminHandler(req, res, next) {
  try {
    const { password } = req.body || {};
    if (!password || password.length < 10) {
      res.status(400).json({ error: "Admin password must be at least 10 characters." });
      return;
    }

    await createAdmin(password);
    res.cookie(COOKIE_NAME, encodeSession(), cookieOptions(req));
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const { password } = req.body || {};
    if (!(await verifyAdmin(password || ""))) {
      res.status(401).json({ error: "Invalid admin password." });
      return;
    }

    res.cookie(COOKIE_NAME, encodeSession(), cookieOptions(req));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export function logoutHandler(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
  res.json({ ok: true });
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    maxAge: SESSION_TTL_MS
  };
}
