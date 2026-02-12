import { buildApp } from "./app";
import { seedDatabase } from "./seed";
import { logger } from "../shared/infra/logger/logger";

const app = buildApp();
const port = Number(process.env.PORT ?? "3000");

// Seed demo data in dev mode
if (process.env.NODE_ENV !== "production") {
  seedDatabase().catch((err) => logger.error({ err }, "[seed] Error"));
}

app.listen(port);
logger.info({ port }, `API running on http://localhost:${port}`);
