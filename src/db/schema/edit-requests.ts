import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { billingPeriods } from "./billing-periods";
import { user } from "./auth";

export const editRequests = sqliteTable(
  "edit_requests",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .references(() => billingPeriods.id)
      .notNull(),
    requestedBy: text("requested_by")
      .references(() => user.id)
      .notNull(),
    reason: text("reason").notNull(),
    proposedValues: text("proposed_values").notNull(), // JSON string
    status: text("status", {
      enum: ["pending", "approved", "rejected", "cancelled"],
    })
      .default("pending")
      .notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewNote: text("review_note"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`
    ),
  },
  (table) => [
    index("idx_edit_requests_period").on(table.billingPeriodId),
    index("idx_edit_requests_status").on(table.status),
  ]
);
