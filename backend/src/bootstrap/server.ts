import { buildApp } from "./app";
import { seedDatabase } from "./seed";

const app = buildApp();
const port = Number(process.env.PORT ?? "3000");

// Seed demo data in dev mode
if (process.env.NODE_ENV !== "production") {
  seedDatabase().catch((err) => console.error("[seed] Error:", err));
}

app.listen(port);
console.log(`API running on http://localhost:${port}`);
