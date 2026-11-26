import { getTenantDbFromEnv } from "../tenancy/infra/tenantDbFactory";
import { usersTable, userProfilesTable } from "../identity/infra/persistence/schema";
import { eventsTable, categoriesTable, sponsorsTable, levelsTable, memberRolesTable } from "../contest/infra/persistence/schema";
import { BcryptHasher } from "../identity/infra/crypto/bcryptHasher";

const LEVELS = [
  { name: "Juniors", sortOrder: 0, freeToEnter: true },
  { name: "Standard", sortOrder: 1, freeToEnter: false },
  { name: "Masters", sortOrder: 2, freeToEnter: false },
  { name: "All", sortOrder: 3, freeToEnter: false }
] as const;

type LevelName = (typeof LEVELS)[number]["name"];

// Monte San Savino Show classes: array index = Class ID
const CLASSES: ReadonlyArray<readonly [name: string, level: LevelName]> = [
  ["Juniors", "Juniors"],
  ["Historical Painting", "Standard"],
  ["Historical Painting", "Masters"],
  ["Fantasy Painting", "Standard"],
  ["Fantasy Painting", "Masters"],
  ["Open Historical", "Standard"],
  ["Open Historical", "Masters"],
  ["Open Fantasy", "Standard"],
  ["Open Fantasy", "Masters"],
  ["Storytelling", "Standard"],
  ["Storytelling", "Masters"],
  ["Sculpting", "Standard"],
  ["Sculpting", "Masters"],
  ["Ordnance Military Modelling - Unaltered", "Standard"],
  ["Ordnance Military Modelling - Unaltered", "Masters"],
  ["Ordnance Military Modelling - Converted", "Standard"],
  ["Ordnance Military Modelling - Converted", "Masters"],
  ["Open Ordnance Military Modelling", "All"],
  ["Ordnance Military Modelling Diorama", "Standard"],
  ["Ordnance Military Modelling Diorama", "Masters"],
  ["Ordnance Sci-fi - Unaltered", "Standard"],
  ["Ordnance Sci-fi - Unaltered", "Masters"],
  ["Ordnance Sci-fi - Converted", "Standard"],
  ["Ordnance Sci-fi - Converted", "Masters"],
  ["Ordnance Sci-fi Diorama", "All"],
  ["Cow Contest", "All"],
  ["Out Of Competition", "All"],
  ["Time Chronicles Painting", "Standard"],
  ["Time Chronicles Painting", "Masters"],
  ["Open Time Chronicles", "Standard"],
  ["Open Time Chronicles", "Masters"],
  ["Open Ordnance Time Chronicles", "All"],
  ["Ordnance Time Chronicles Diorama", "All"]
];

const OUT_OF_COMPETITION_CLASS = 26;
const SECOND_EVENT_CLASSES = [0, 1, 2, 3, 4];

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

  // --- Levels ---
  const levels = LEVELS.map((level) => ({ id: crypto.randomUUID(), ...level }));
  await db.insert(levelsTable).values(levels);
  const levelIds = new Map<LevelName, string>(levels.map((l) => [l.name, l.id]));

  // --- Categories ---
  const categoryFor = (eventId: string, classId: number) => {
    const [name, level] = CLASSES[classId]!;
    return {
      id: crypto.randomUUID(),
      eventId,
      name,
      status: "open",
      classNumber: String(classId),
      levelId: levelIds.get(level)!,
      presentationOrder: classId,
      outOfCompetition: classId === OUT_OF_COMPETITION_CLASS
    };
  };
  await db.insert(categoriesTable).values([
    ...CLASSES.map((_, classId) => categoryFor(event1Id, classId)),
    ...SECOND_EVENT_CLASSES.map((classId) => categoryFor(event2Id, classId))
  ]);

  // --- Sponsors ---
  await db.insert(sponsorsTable).values([
    { id: crypto.randomUUID(), eventId: event1Id, name: "Citadel Colour", tier: "gold" },
    { id: crypto.randomUUID(), eventId: event1Id, name: "Vallejo", tier: "silver" }
  ]);

  // --- Member Roles --- (ensureTenantSchema already inserts the defaults: add only missing names)
  const existingRoles = new Set(
    (await db.select({ name: memberRolesTable.name }).from(memberRolesTable)).map((r) => r.name.trim().toLowerCase())
  );
  const missingRoles = ["Scultore", "Pittore", "Concept Artist", "Art Director"]
    .filter((name) => !existingRoles.has(name.toLowerCase()))
    .map((name) => ({ id: crypto.randomUUID(), name }));
  if (missingRoles.length) await db.insert(memberRolesTable).values(missingRoles);

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
