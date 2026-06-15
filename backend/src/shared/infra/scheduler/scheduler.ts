import { logger } from "../logger/logger";

export type SchedulerJob = {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
};

export class Scheduler {
  private jobs: SchedulerJob[] = [];

  register(job: SchedulerJob): void {
    this.jobs.push(job);
    logger.info(
      { job: job.name, cron: job.cronExpression },
      "Scheduler job registered (TODO: activate real cron)"
    );
    // TODO: replace with actual cron (node-cron, bun setInterval, or external job queue)
  }

  async runNow(jobName: string): Promise<void> {
    const job = this.jobs.find((j) => j.name === jobName);
    if (!job) throw new Error(`Scheduler job not found: ${jobName}`);
    logger.info({ job: jobName }, "Running scheduler job manually");
    await job.handler();
  }
}

export const scheduler = new Scheduler();
