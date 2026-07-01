import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";

export type AutomationJobData = {
  runId: string;
};

export type SchedulerJobData = {
  scheduleId: string;
};

function createConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });
}

let automationQueueInstance: Queue<AutomationJobData> | undefined;
let schedulerQueueInstance: Queue<SchedulerJobData> | undefined;

export function automationQueue() {
  automationQueueInstance ??= new Queue<AutomationJobData>("automation-runs", {
    connection: createConnection()
  });
  return automationQueueInstance;
}

export function schedulerQueue() {
  schedulerQueueInstance ??= new Queue<SchedulerJobData>("automation-schedules", {
    connection: createConnection()
  });
  return schedulerQueueInstance;
}

export async function enqueueAutomationRun(runId: string): Promise<void> {
  await automationQueue().add(
    "run",
    { runId },
    {
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  );
}
