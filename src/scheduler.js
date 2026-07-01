import cron from "node-cron";
import { listSchedules } from "./store.js";

export class AutomationScheduler {
  constructor(runNow) {
    this.runNow = runNow;
    this.jobs = new Map();
  }

  start() {
    this.reload();
  }

  reload() {
    for (const job of this.jobs.values()) {
      if (job.stop) {
        job.stop();
      }
      if (job.timer) {
        clearTimeout(job.timer);
      }
    }
    this.jobs.clear();

    for (const schedule of listSchedules()) {
      this.register(schedule);
    }
  }

  register(schedule) {
    if (!schedule.enabled) {
      return;
    }

    if (schedule.type === "daily") {
      const [hour, minute] = schedule.time.split(":").map(Number);
      if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
        return;
      }

      const job = cron.schedule(`${minute} ${hour} * * *`, () => {
        this.runNow({
          source: "scheduled",
          scheduleId: schedule.id,
          requestedRange: { dateMode: schedule.dateMode || "yesterday" }
        });
      });
      this.jobs.set(schedule.id, job);
      return;
    }

    if (schedule.type === "once") {
      const runAt = new Date(schedule.runAt).getTime();
      const delay = runAt - Date.now();
      if (!Number.isFinite(delay) || delay <= 0) {
        return;
      }

      const timer = setTimeout(() => {
        this.runNow({
          source: "scheduled",
          scheduleId: schedule.id,
          requestedRange: {
            dateMode: schedule.dateMode || "custom",
            fromDate: schedule.fromDate,
            toDate: schedule.toDate
          }
        });
      }, delay);
      this.jobs.set(schedule.id, { timer });
    }
  }
}
