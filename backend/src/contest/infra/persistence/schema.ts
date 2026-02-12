import { pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex, numeric } from "drizzle-orm/pg-core";

export const teamsTable = pgTable("teams", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull()
});

export const teamMembersTable = pgTable("team_members", {
  teamId: uuid("team_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull()
}, (t) => ({
  uniq: uniqueIndex("ux_team_user").on(t.teamId, t.userId)
}));

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date")
});

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  status: text("status").default("open").notNull() // open | closed
});

export const registrationsTable = pgTable("registrations", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  eventId: uuid("event_id").notNull(),
  modelId: uuid("model_id"),
  categoryId: uuid("category_id"),
  status: text("status").notNull(),
  checkedIn: boolean("checked_in").default(false).notNull()
}, (t) => ({
  uniq: uniqueIndex("ux_reg_user_event").on(t.userId, t.eventId)
}));

export const modelsTable = pgTable("models", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  teamId: uuid("team_id"),
  categoryId: uuid("category_id").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url")
});

export const modelImagesTable = pgTable("model_images", {
  id: uuid("id").primaryKey(),
  modelId: uuid("model_id").notNull(),
  url: text("url").notNull()
});

export const votesTable = pgTable("votes", {
  id: uuid("id").primaryKey(),
  judgeId: uuid("judge_id").notNull(),
  modelId: uuid("model_id").notNull(),
  rank: integer("rank").notNull(), // 0..3
  createdAt: timestamp("created_at").defaultNow()
}, (t) => ({
  uniq: uniqueIndex("ux_votes_judge_model").on(t.judgeId, t.modelId)
}));

export const judgeAssignmentsTable = pgTable("judge_assignments", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  judgeId: uuid("judge_id").notNull(),
  categoryId: uuid("category_id") // null = all categories in event
}, (t) => ({
  uniq: uniqueIndex("ux_judge_event").on(t.eventId, t.judgeId)
}));

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey(),
  registrationId: uuid("registration_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at").defaultNow()
});

export const sponsorsTable = pgTable("sponsors", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  description: text("description"),
  tier: text("tier").default("bronze").notNull() // bronze | silver | gold | platinum
});

export const specialMentionsTable = pgTable("special_mentions", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  modelId: uuid("model_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  awardedBy: uuid("awarded_by").notNull(), // manager/admin userId
  createdAt: timestamp("created_at").defaultNow()
});

export const modificationRequestsTable = pgTable("modification_requests", {
  id: uuid("id").primaryKey(),
  modelId: uuid("model_id").notNull(),
  judgeId: uuid("judge_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(), // pending | resolved | rejected
  createdAt: timestamp("created_at").defaultNow()
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});
