import { pgTable, text, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";

export const plans = pgTable("plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  mikrotikProfile: varchar("mikrotik_profile", { length: 100 }).notNull(),
  rateLimit: varchar("rate_limit", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }).notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  planId: integer("plan_id").references(() => plans.id),
  macAddress: varchar("mac_address", { length: 17 }),
  username: varchar("username", { length: 100 }),
  password: varchar("password", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const activityLog = pgTable("activity_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  paymentId: integer("payment_id").references(() => payments.id),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
