import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";
import { runAutomationJob } from "@/automation/runAutomationJob";
import type { AutomationJobData } from "@/lib/queue";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const worker = new Worker<AutomationJobData>(
  "automation-runs",
  async (job) => {
    logInfo("Starting automation job", { jobId: job.id, runId: job.data.runId });
    await runAutomationJob(job.data.runId);
  },
  { connection, concurrency: 1 }
);

worker.on("completed", (job) => {
  logInfo("Automation job completed", { jobId: job.id, runId: job.data.runId });
});

worker.on("failed", (job, error) => {
  logError("Automation job failed", {
    jobId: job?.id,
    runId: job?.data.runId,
    message: error.message
  });
});
