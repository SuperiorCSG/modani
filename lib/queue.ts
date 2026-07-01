import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "@/lib/env";

export type AutomationJobData = {
  runId: string;
};

export type SchedulerJobData = {
  scheduleId: string;
};

export function redisConnectionOptions(): ConnectionOptions {
  const parsed = new URL(env.REDIS_URL);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null
  };
}

let automationQueueInstance: Queue<AutomationJobData> | undefined;
let schedulerQueueInstance: Queue<SchedulerJobData> | undefined;

export function automationQueue() {
  automationQueueInstance ??= new Queue<AutomationJobData>("automation-runs", {
    connection: redisConnectionOptions()
  });
  return automationQueueInstance;
}

export function schedulerQueue() {
  schedulerQueueInstance ??= new Queue<SchedulerJobData>("automation-schedules", {
    connection: redisConnectionOptions()
  });
  return schedulerQueueInstance;
}

export async function enqueueAutomationRun(runId: string): Promise<void> {
  const queue = automationQueue();
  await queue.add(
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
