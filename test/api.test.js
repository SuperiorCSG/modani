import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir;
let app;

async function loadFreshApp(automationRunner = vi.fn()) {
  vi.resetModules();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "automation-tool-"));
  process.env.DATA_FILE = path.join(tempDir, "db.json");
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.APP_ENCRYPTION_KEY = "test-encryption-key";
  const module = await import("../src/server.js");
  app = module.createApp({ automationRunner });
  return app;
}

async function loginAgent(password = "supersecure") {
  const agent = request.agent(app);
  await agent.post("/api/setup").send({ password }).expect(201);
  return agent;
}

async function waitFor(predicate) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1000) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for condition.");
}

describe("admin automation API", () => {
  beforeEach(async () => {
    delete process.env.ADMIN_PASSWORD;
    await loadFreshApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("requires admin setup and protects state", async () => {
    await request(app).get("/api/session").expect(200).expect({
      adminConfigured: false,
      authenticated: false
    });

    await request(app).get("/api/state").expect(401);
    const agent = await loginAgent();
    const stateResponse = await agent.get("/api/state").expect(200);
    expect(stateResponse.body.adminConfigured).toBe(true);
    expect(stateResponse.body.settings.targetUrl).toBe(
      "https://caringcompanionsmacon.clearcareonline.com/"
    );
    expect(stateResponse.body.settings.dryRun).toBe(true);
  });

  it("saves target settings without exposing the password", async () => {
    const agent = await loginAgent();
    const response = await agent
      .put("/api/settings")
      .send({
        targetUrl: "https://care.example.test/login",
        username: "automation-user",
        password: "target-password",
        headless: true,
        dryRun: true,
        timeoutMs: 20000,
        selectors: {
          login: {
            username: "#user",
            password: "#pass",
            submit: "#submit"
          }
        }
      })
      .expect(200);

    expect(response.body.settings.passwordConfigured).toBe(true);
    expect(response.body.settings.passwordEncrypted).toBeUndefined();
  });

  it("queues a manual run and records completion summary", async () => {
    const automationRunner = vi.fn(async ({ settings, requestedRange, log }) => {
      log(`ran against ${settings.targetUrl}`);
      return {
        dateRange: {
          fromDate: requestedRange.fromDate,
          toDate: requestedRange.toDate
        },
        scannedReports: 2,
        openedCareLogs: 1,
        skippedIncompleteTasks: 1,
        signedCareLogs: 1
      };
    });
    await loadFreshApp(automationRunner);
    const agent = await loginAgent();
    await agent
      .put("/api/settings")
      .send({
        targetUrl: "https://care.example.test/login",
        username: "automation-user",
        password: "target-password",
        selectors: {}
      })
      .expect(200);

    await agent
      .post("/api/runs")
      .send({
        dateMode: "custom",
        fromDate: "2026-06-01",
        toDate: "2026-06-02"
      })
      .expect(202);

    const completedState = await waitFor(async () => {
      const response = await agent.get("/api/state").expect(200);
      return response.body.runs[0]?.status === "completed" ? response.body : null;
    });

    expect(automationRunner).toHaveBeenCalledTimes(1);
    expect(completedState.runs[0].summary.signedCareLogs).toBe(1);
    expect(completedState.runs[0].logs[0].message).toContain("care.example.test");
  });

  it("creates and deletes schedules", async () => {
    const agent = await loginAgent();
    const createResponse = await agent
      .post("/api/schedules")
      .send({
        name: "Daily previous day report",
        type: "daily",
        time: "00:00",
        dateMode: "yesterday"
      })
      .expect(201);

    const id = createResponse.body.schedule.id;
    let stateResponse = await agent.get("/api/state").expect(200);
    expect(stateResponse.body.schedules).toHaveLength(1);

    await agent.delete(`/api/schedules/${id}`).expect(204);
    stateResponse = await agent.get("/api/state").expect(200);
    expect(stateResponse.body.schedules).toHaveLength(0);
  });
});
