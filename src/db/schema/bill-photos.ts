import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

import { billingPeriods } from "./billing-periods";
import { user } from "./auth";
import { editRequests } from "./edit-requests";

export const billPhotos = sqliteTable(
  "bill_photos",
  {
    id: text("id").primaryKey(),

    // Denormalized for efficient cleanup on property delete.
    // Allows R2 prefix sweep: {propertyId}/{periodId}/{userId}/{ts}.webp
    propertyId: text("property_id").notNull(),

    billingPeriodId: text("billing_period_id")
      .references(() => billingPeriods.id)
      .notNull(),
    uploadedBy: text("uploaded_by")
      .references(() => user.id)
      .notNull(),

    // R2 object key: {propertyId}/{periodId}/{userId}/{timestamp}.{ext}
    objectKey: text("object_key").notNull().unique(),

    // What this photo is of:
    // 'import_meter'  — physical meter showing import kWh reading
    // 'export_meter'  — physical meter showing export kWh reading
    // 'solar_meter'   — physical meter showing solar generation kWh reading
    // 'bill_document' — full utility bill (PDF rendered to image, or photo of paper bill)
    purpose: text("purpose", {
      enum: ["import_meter", "export_meter", "solar_meter", "bill_document"],
    }).notNull(),

    // Version number within (billingPeriodId, purpose, uploadedBy).
    // Starts at 1. Increments on re-upload. Max 3 per (period, purpose, user).
    version: integer("version").notNull().default(1),

    // 'active'     — current photo for this (period, purpose, user)
    // 'superseded' — replaced by a newer version, kept temporarily until cap exceeded
    status: text("status", { enum: ["active", "superseded"] })
      .notNull()
      .default("active"),

    // Non-null if this photo was uploaded as part of an edit request.
    // If edit request is rejected, this photo is deleted.
    editRequestId: text("edit_request_id").references(() => editRequests.id),

    uploadedAt: integer("uploaded_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`
    ),
  },
  (table) => [
    index("idx_bill_photos_period_purpose_user").on(
      table.billingPeriodId,
      table.purpose,
      table.uploadedBy
    ),
    index("idx_bill_photos_property").on(table.propertyId),
  ]
);
