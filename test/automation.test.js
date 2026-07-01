import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SELECTORS } from "../src/defaultSelectors.js";
import { runUnsignedCareLogAutomation } from "../src/automation.js";

let server;
let baseUrl;

function page(content) {
  return `<!doctype html><html><body>${content}</body></html>`;
}

beforeAll(async () => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.get("/login", (_req, res) => {
    res.send(
      page(`
        <form action="/reports" method="get">
          <input name="username" />
          <input name="password" type="password" />
          <button type="submit">Login</button>
        </form>
      `)
    );
  });

  app.get("/reports", (_req, res) => {
    res.send(
      page(`
        <a href="/reports">Reports</a>
        <select name="reportType"><option>Unsigned Care Logs</option></select>
        <input name="fromDate" />
        <input name="toDate" />
        <select name="groupBy"><option>State Client</option></select>
        <select name="client"><option value="all">All Clients</option></select>
        <button>Run Report</button>
        <table>
          <tbody>
            <tr>
              <td data-column="client-signed" data-value="signed">checked</td>
              <td data-column="caregiver-signed" data-value="signed">checked</td>
              <td><a target="_blank" href="/care-log/complete">Not Signed</a></td>
            </tr>
            <tr>
              <td data-column="client-signed" data-value="signed">checked</td>
              <td data-column="caregiver-signed" data-value="signed">checked</td>
              <td><a target="_blank" href="/care-log/incomplete">Not Signed</a></td>
            </tr>
          </tbody>
        </table>
      `)
    );
  });

  app.get("/care-log/:status", (req, res) => {
    const complete = req.params.status === "complete";
    res.send(
      page(`
        <div data-task-row><span data-task-status data-value="completed">checked</span></div>
        <div data-task-row><span data-task-status data-value="${complete ? "completed" : "cross"}">${complete ? "checked" : "cross"}</span></div>
        <button onclick="document.querySelector('[role=dialog]').hidden = false">Sign</button>
        <div role="dialog" hidden>
          <p>Prepared by</p>
          <p data-care-manager-name>Jane Manager</p>
          <textarea name="signature"></textarea>
          <button>Submit</button>
        </div>
      `)
    );
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("unsigned care log automation", () => {
  it("signs only care logs with completed task lists", async () => {
    const logs = [];
    const summary = await runUnsignedCareLogAutomation({
      settings: {
        targetUrl: `${baseUrl}/login`,
        username: "admin",
        password: "secret",
        headless: true,
        timeoutMs: 5000,
        selectors: DEFAULT_SELECTORS
      },
      requestedRange: {
        dateMode: "custom",
        fromDate: "2026-06-01",
        toDate: "2026-06-02"
      },
      log: (message) => logs.push(message)
    });

    expect(summary).toMatchObject({
      scannedReports: 2,
      openedCareLogs: 2,
      skippedIncompleteTasks: 1,
      signedCareLogs: 1
    });
    expect(logs.join("\n")).toContain("Signed care log from row 1.");
    expect(logs.join("\n")).toContain("Skipping care log from row 2");
  }, 20000);
});
