import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { DEFAULT_SELECTORS } from "./defaultSelectors.js";
import { decryptSecret, encryptSecret } from "./cryptoBox.js";

const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "db.json");

const emptyState = () => ({
  admin: null,
  settings: {
    targetUrl: "",
    username: "",
    passwordEncrypted: "",
    headless: true,
    timeoutMs: 30000,
    selectors: DEFAULT_SELECTORS
  },
  schedules: [],
  runs: []
});

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyState(), null, 2));
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, override) {
  const output = clone(base);
  for (const [key, value] of Object.entries(override || {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function readState() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = raw.trim() ? JSON.parse(raw) : emptyState();
  return {
    ...emptyState(),
    ...parsed,
    settings: {
      ...emptyState().settings,
      ...(parsed.settings || {}),
      selectors: deepMerge(DEFAULT_SELECTORS, parsed.settings?.selectors || {})
    }
  };
}

function writeState(state) {
  ensureDataFile();
  const tmpFile = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  fs.renameSync(tmpFile, DATA_FILE);
}

function publicSettings(settings) {
  return {
    ...clone(settings),
    passwordConfigured: Boolean(settings.passwordEncrypted),
    passwordEncrypted: undefined
  };
}

export function getState() {
  const state = readState();
  return {
    adminConfigured: Boolean(state.admin?.passwordHash),
    settings: publicSettings(state.settings),
    schedules: clone(state.schedules),
    runs: clone(state.runs)
  };
}

export async function ensureAdminFromEnv() {
  const state = readState();
  if (state.admin?.passwordHash || !process.env.ADMIN_PASSWORD) {
    return;
  }

  state.admin = {
    passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
    createdAt: new Date().toISOString()
  };
  writeState(state);
}

export async function createAdmin(password) {
  const state = readState();
  if (state.admin?.passwordHash) {
    const error = new Error("Admin is already configured.");
    error.status = 409;
    throw error;
  }

  state.admin = {
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: new Date().toISOString()
  };
  writeState(state);
}

export async function verifyAdmin(password) {
  const state = readState();
  if (!state.admin?.passwordHash) {
    return false;
  }

  return bcrypt.compare(password, state.admin.passwordHash);
}

export function getAutomationSettings() {
  const state = readState();
  return {
    ...clone(state.settings),
    password: decryptSecret(state.settings.passwordEncrypted)
  };
}

export function saveAutomationSettings(settings) {
  const state = readState();
  const passwordEncrypted =
    settings.password && settings.password.length > 0
      ? encryptSecret(settings.password)
      : state.settings.passwordEncrypted;

  state.settings = {
    ...state.settings,
    targetUrl: settings.targetUrl || "",
    username: settings.username || "",
    passwordEncrypted,
    headless: settings.headless !== false,
    timeoutMs: Number(settings.timeoutMs) || 30000,
    selectors: deepMerge(DEFAULT_SELECTORS, settings.selectors || {})
  };

  writeState(state);
  return publicSettings(state.settings);
}

export function createSchedule(schedule) {
  const state = readState();
  const now = new Date().toISOString();
  const created = {
    id: nanoid(),
    type: schedule.type,
    name: schedule.name || `${schedule.type} automation`,
    time: schedule.time || "",
    runAt: schedule.runAt || "",
    dateMode: schedule.dateMode || "yesterday",
    fromDate: schedule.fromDate || "",
    toDate: schedule.toDate || "",
    enabled: schedule.enabled !== false,
    lastRunAt: "",
    createdAt: now,
    updatedAt: now
  };
  state.schedules.push(created);
  writeState(state);
  return created;
}

export function updateSchedule(id, updates) {
  const state = readState();
  const schedule = state.schedules.find((item) => item.id === id);
  if (!schedule) {
    const error = new Error("Schedule not found.");
    error.status = 404;
    throw error;
  }

  Object.assign(schedule, updates, { updatedAt: new Date().toISOString() });
  writeState(state);
  return schedule;
}

export function deleteSchedule(id) {
  const state = readState();
  state.schedules = state.schedules.filter((item) => item.id !== id);
  writeState(state);
}

export function listSchedules() {
  return clone(readState().schedules);
}

export function createRun(run) {
  const state = readState();
  const created = {
    id: nanoid(),
    status: "queued",
    source: run.source || "manual",
    scheduleId: run.scheduleId || "",
    requestedRange: run.requestedRange,
    startedAt: "",
    finishedAt: "",
    summary: null,
    logs: [],
    error: "",
    createdAt: new Date().toISOString()
  };
  state.runs.unshift(created);
  state.runs = state.runs.slice(0, 200);
  writeState(state);
  return created;
}

export function updateRun(id, updates) {
  const state = readState();
  const run = state.runs.find((item) => item.id === id);
  if (!run) {
    const error = new Error("Run not found.");
    error.status = 404;
    throw error;
  }

  Object.assign(run, updates);
  writeState(state);
  return clone(run);
}

export function appendRunLog(id, message) {
  const state = readState();
  const run = state.runs.find((item) => item.id === id);
  if (!run) {
    return;
  }

  run.logs.push({
    at: new Date().toISOString(),
    message
  });
  writeState(state);
}

export function markScheduleRan(id) {
  if (!id) {
    return;
  }

  const state = readState();
  const schedule = state.schedules.find((item) => item.id === id);
  if (!schedule) {
    return;
  }

  schedule.lastRunAt = new Date().toISOString();
  if (schedule.type === "once") {
    schedule.enabled = false;
  }
  writeState(state);
}
