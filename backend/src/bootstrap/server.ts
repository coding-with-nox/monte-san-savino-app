import { buildApp } from "./app";
import { seedDatabase } from "./seed";
import { logger } from "../shared/infra/logger/logger";
import { ensureTenantSchema } from "../tenancy/infra/persistence/ensureTenantSchema";
import { scheduler } from "../shared/infra/scheduler/scheduler";

scheduler.register({
  name: "incomplete-registration-reminder",
  cronExpression: "0 8 * * *", // daily at 08:00
  handler: async () => {
    // TODO: for each tenant, find campaigns with enrollmentCloseDate in [now+6d, now+8d],
    // find enrolled users with no models, send reminder via emailService
    logger.info("incomplete-registration-reminder: TODO — not yet implemented");
  },
});

async function start() {
  await ensureTenantSchema();

  const app = buildApp();
  const port = Number(process.env.PORT ?? "3000");

  // Seed demo data in dev mode
  if (process.env.NODE_ENV !== "production") {
    seedDatabase().catch((err) => logger.error({ err }, "[seed] Error"));
  }

  app.listen(port);
  logger.info({ port }, `API running on http://localhost:${port}`);
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start API");
  process.exit(1);
});
