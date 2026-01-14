import { pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

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
  name: text("name").notNull()
});

export const registrationsTable = pgTable("registrations", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  eventId: uuid("event_id").notNull(),
  status: text("status").notNull(),
  checkedIn: boolean("checked_in").default(false).notNull()
}, (t) => ({
  uniq: uniqueIndex("ux_reg_user_event").on(t.userId, t.eventId)
}));

export const modelsTable = pgTable("models", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  categoryId: uuid("category_id").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url")
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
