import { pgTable, uuid, text, boolean, serial, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  seqId: serial("seq_id"),
  /** GDPR accountability: when the user acknowledged the privacy notice, and which version. */
  privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
  privacyPolicyVersion: text("privacy_policy_version"),
  /** Optional login name (3-30 chars [a-zA-Z0-9._-]); unique case-insensitively. */
  username: text("username")
}, (t) => ({
  uxUsername: uniqueIndex("ux_users_username").on(sql`lower(${t.username})`)
}));

/** Forgotten-password tokens: only the sha256 of the token is stored. */
export const passwordResetsTable = pgTable("password_resets", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => ({
  byUser: index("ix_password_resets_user_id").on(t.userId)
}));

export const userProfilesTable = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  city: text("city"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  emergencyContactName: text("emergency_contact_name"),
  avatarUrl: text("avatar_url"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  website: text("website"),
  patreon: text("patreon"),
  pinterest: text("pinterest"),
  tiktok: text("tiktok"),
  country: text("country"),
  publicProfile: boolean("public_profile").default(false).notNull()
});
