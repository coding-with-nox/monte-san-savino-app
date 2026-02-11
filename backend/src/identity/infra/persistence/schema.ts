import { pgTable, uuid, text, boolean } from "drizzle-orm/pg-core";
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true).notNull()
});

export const userProfilesTable = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  city: text("city"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  emergencyContactName: text("emergency_contact_name"),
  avatarUrl: text("avatar_url")
});
