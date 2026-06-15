import { pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex, index, serial } from "drizzle-orm/pg-core";

export const levelsTable = pgTable("levels", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order")
});

export const memberRolesTable = pgTable("member_roles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull()
});

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").default("accepted").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date")
});

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  status: text("status").default("open").notNull(),
  seqId: serial("seq_id").notNull()
});

export const eventCampaignsTable = pgTable("event_campaigns", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  enrollmentOpenDate: text("enrollment_open_date"),
  enrollmentCloseDate: text("enrollment_close_date")
});

export const registrationsTable = pgTable("registrations", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  eventId: uuid("event_id").notNull(),
  modelId: uuid("model_id"),
  categoryId: uuid("category_id"),
  status: text("status").notNull(),
  checkedIn: boolean("checked_in").default(false).notNull()
});

export const modelsTable = pgTable("models", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  categoryId: uuid("category_id").notNull(),
  levelId: uuid("level_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  code: integer("code"),
  imageUrl: text("image_url"),
  isTeam: boolean("is_team").default(false).notNull(),
  displayNumber: integer("display_number")
}, (t) => ({
  uniqCode: uniqueIndex("ux_models_code").on(t.code)
}));

export const modelTeamMembersTable = pgTable("model_team_members", {
  id: uuid("id").primaryKey(),
  modelId: uuid("model_id").notNull(),
  name: text("name").notNull(),
  surname: text("surname").notNull(),
  role: text("role").notNull(),
  email: text("email")
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
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (t) => ({
  byJudgeModel: index("ix_votes_judge_model").on(t.judgeId, t.modelId),
  byModelCreatedAt: index("ix_votes_model_created_at").on(t.modelId, t.createdAt)
}));

export const judgeAssignmentsTable = pgTable("judge_assignments", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  judgeId: uuid("judge_id").notNull(),
  categoryId: uuid("category_id")
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
  tier: text("tier").default("bronze").notNull()
});

export const specialMentionsTable = pgTable("special_mentions", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  modelId: uuid("model_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  awardedBy: uuid("awarded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const modificationRequestsTable = pgTable("modification_requests", {
  id: uuid("id").primaryKey(),
  modelId: uuid("model_id").notNull(),
  judgeId: uuid("judge_id").notNull(),
  reason: text("reason").notNull(),
  suggestedCategoryId: uuid("suggested_category_id"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});
