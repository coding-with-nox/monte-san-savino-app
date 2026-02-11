import { getTenantDbFromEnv } from "../tenancy/infra/tenantDbFactory";
import { usersTable, userProfilesTable } from "../identity/infra/persistence/schema";
import { eventsTable, categoriesTable, sponsorsTable } from "../contest/infra/persistence/schema";
import { BcryptHasher } from "../identity/infra/crypto/bcryptHasher";

export async function seedDatabase() {
  const db = getTenantDbFromEnv();

  // Check if DB already has data
  const existingEvents = await db.select().from(eventsTable);
  if (existingEvents.length > 0) {
    console.log("[seed] Database already has data, skipping seed.");
    return;
  }

  console.log("[seed] Empty database detected, seeding demo data...");
  const hasher = new BcryptHasher();

  // --- Users ---
  const adminId = crypto.randomUUID();
  const judgeId = crypto.randomUUID();
  const user1Id = crypto.randomUUID();
  const user2Id = crypto.randomUUID();

  await db.insert(usersTable).values([
    { id: adminId, email: "admin@contest.it", role: "admin", passwordHash: await hasher.hash("Admin123!"), isActive: true },
    { id: judgeId, email: "judge@contest.it", role: "judge", passwordHash: await hasher.hash("Judge123!"), isActive: true },
    { id: user1Id, email: "user1@contest.it", role: "user", passwordHash: await hasher.hash("User123!"), isActive: true },
    { id: user2Id, email: "user2@contest.it", role: "user", passwordHash: await hasher.hash("User123!"), isActive: true }
  ]);

  await db.insert(userProfilesTable).values([
    { userId: adminId, firstName: "Admin", lastName: "Demo", phone: "+39 02 1234567", city: "Milano, Italia" },
    { userId: judgeId, firstName: "Giudice", lastName: "Demo", phone: "+39 055 9876543", city: "Firenze, Italia" },
    { userId: user1Id, firstName: "Mario", lastName: "Rossi", phone: "+39 06 5551234", city: "Roma, Italia" },
    { userId: user2Id, firstName: "Luca", lastName: "Bianchi", phone: "+39 011 4445678", city: "Torino, Italia" }
  ]);

  // --- Events ---
  const event1Id = crypto.randomUUID();
  const event2Id = crypto.randomUUID();

  await db.insert(eventsTable).values([
    { id: event1Id, name: "Concorso Miniature 2025", status: "active", startDate: "2025-06-01", endDate: "2025-06-03" },
    { id: event2Id, name: "Concorso Pittura 2025", status: "draft", startDate: "2025-09-15", endDate: "2025-09-17" }
  ]);

  // --- Categories ---
  await db.insert(categoriesTable).values([
    { id: crypto.randomUUID(), eventId: event1Id, name: "Fantasy", status: "open" },
    { id: crypto.randomUUID(), eventId: event1Id, name: "Sci-Fi", status: "open" },
    { id: crypto.randomUUID(), eventId: event2Id, name: "Storico", status: "open" },
    { id: crypto.randomUUID(), eventId: event2Id, name: "Diorama", status: "open" }
  ]);

  // --- Sponsors ---
  await db.insert(sponsorsTable).values([
    { id: crypto.randomUUID(), eventId: event1Id, name: "Citadel Colour", tier: "gold" },
    { id: crypto.randomUUID(), eventId: event1Id, name: "Vallejo", tier: "silver" }
  ]);

  console.log("[seed] Demo data inserted successfully.");
  console.log("[seed] Admin login: admin@contest.it / Admin123!");
  console.log("[seed] Judge login: judge@contest.it / Judge123!");
  console.log("[seed] User logins: user1@contest.it, user2@contest.it / User123!");
}

// Allow standalone execution: bun src/bootstrap/seed.ts
if (import.meta.main) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
