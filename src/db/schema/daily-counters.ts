import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const uploadDailyCount = sqliteTable(
  "upload_daily_count",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    dateKey: text("date_key").notNull(), // 'YYYY-MM-DD' UTC
    count: integer("count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("upload_daily_count_user_date_unique").on(
      table.userId,
      table.dateKey
    ),
  ]
);

export const readingDailyCount = sqliteTable(
  "reading_daily_count",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    dateKey: text("date_key").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("reading_daily_count_user_date_unique").on(
      table.userId,
      table.dateKey
    ),
  ]
);
