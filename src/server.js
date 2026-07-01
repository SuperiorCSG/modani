import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendRunLog,
  createRun,
  createSchedule,
  deleteSchedule,
  ensureAdminFromEnv,
  getAutomationSettings,
  getState,
  markScheduleRan,
  saveAutomationSettings,
  updateRun,
  updateSchedule
} from "./store.js";
import {
  installAuth,
  loginHandler,
  logoutHandler,
  requireAdmin,
  setupAdminHandler
} from "./auth.js";
import { runUnsignedCareLogAutomation } from "./automation.js";
import { resolveDateRange } from "./dateRange.js";
import { AutomationScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

export function createApp({ automationRunner = runUnsignedCareLogAutomation } = {}) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  installAuth(app);

  async function runNow({ source = "manual", scheduleId = "", requestedRange = {} }) {
    const normalizedRange = resolveDateRange(requestedRange);
    const run = createRun({
      source,
      scheduleId,
      requestedRange: {
        dateMode: requestedRange.dateMode || "yesterday",
        ...normalizedRange
      }
    });

    setImmediate(async () => {
      updateRun(run.id, {
        status: "running",
        startedAt: new Date().toISOString()
      });

      try {
        const settings = getAutomationSettings();
        const summary = await automationRunner({
          settings,
          requestedRange,
          log: (message) => appendRunLog(run.id, message)
        });

        updateRun(run.id, {
          status: "completed",
          finishedAt: new Date().toISOString(),
          summary
        });
        markScheduleRan(scheduleId);
      } catch (error) {
        appendRunLog(run.id, error.message);
        updateRun(run.id, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: error.message
        });
      }
    });

    return run;
  }

  const scheduler = new AutomationScheduler(runNow);
  app.locals.scheduler = scheduler;
  app.locals.runNow = runNow;

  app.get("/api/session", (req, res) => {
    const state = getState();
    res.json({
      adminConfigured: state.adminConfigured,
      authenticated: Boolean(req.adminSession)
    });
  });

  app.post("/api/setup", setupAdminHandler);
  app.post("/api/login", loginHandler);
  app.post("/api/logout", logoutHandler);

  app.get("/api/state", requireAdmin, (_req, res) => {
    res.json(getState());
  });

  app.put("/api/settings", requireAdmin, (req, res, next) => {
    try {
      const settings = saveAutomationSettings(req.body || {});
      res.json({ settings });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/runs", requireAdmin, async (req, res, next) => {
    try {
      const run = await runNow({
        source: "manual",
        requestedRange: req.body || {}
      });
      res.status(202).json({ run });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/schedules", requireAdmin, (req, res, next) => {
    try {
      const schedule = createSchedule(req.body || {});
      scheduler.reload();
      res.status(201).json({ schedule });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/schedules/:id", requireAdmin, (req, res, next) => {
    try {
      const schedule = updateSchedule(req.params.id, req.body || {});
      scheduler.reload();
      res.json({ schedule });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/schedules/:id", requireAdmin, (req, res, next) => {
    try {
      deleteSchedule(req.params.id);
      scheduler.reload();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && req.accepts("html")) {
      res.sendFile(path.join(publicDir, "index.html"));
      return;
    }
    next();
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).json({
      error: status === 500 ? "Unexpected server error." : error.message
    });
  });

  return app;
}

export async function start() {
  await ensureAdminFromEnv();
  const app = createApp();
  app.locals.scheduler.start();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Automation admin tool listening on http://localhost:${port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}
