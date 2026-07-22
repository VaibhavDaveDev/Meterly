import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const DB_DIR = path.join(
  ".wrangler",
  "state",
  "v3",
  "d1",
  "miniflare-D1DatabaseObject"
);

// Helper to find the sqlite file
function findDbFile(): string | null {
  if (!fs.existsSync(DB_DIR)) return null;
  const files = fs.readdirSync(DB_DIR);
  const sqliteFile = files.find((f) => f.endsWith(".sqlite"));
  if (sqliteFile) {
    return path.join(DB_DIR, sqliteFile);
  }
  return null;
}

async function run() {
  const dbFile = findDbFile();
  if (!dbFile) {
    console.error(
      "Local D1 database not found. Start the dev server once to create it, or ensure you are running this from the project root."
    );
    process.exit(1);
  }

  console.log(`Connecting to database: ${dbFile}`);
  const db = new Database(dbFile);

  // Turn off foreign keys temporarily for truncation
  db.pragma("foreign_keys = OFF");

  const tablesToClear = [
    "notifications",
    "bill_photos",
    "edit_requests",
    "meter_reading_edits",
    "meter_readings",
    "bills",
    "billing_periods",
    "custom_charges",
    "property_rates",
    "tenancies",
    "properties",
    "verification",
    "session",
    "account",
    "user",
  ];

  console.log("Clearing existing data...");
  for (const table of tablesToClear) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (!err.message.includes("no such table")) {
        throw err;
      }
    }
  }

  db.pragma("foreign_keys = ON");

  console.log("Inserting seed data...");

  const ownerHash = await hashPassword("DemoOwner123");
  const tenantHash = await hashPassword("DemoTenant123");

  const pastTimestamp = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days ago
  const jan1 = Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000);

  // Users
  const insertUser = db.prepare(
    `INSERT INTO user (id, name, email, email_verified, created_at, updated_at, primary_role, onboarding_completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertUser.run(
    "owner-001",
    "Demo Owner",
    "owner@demo.meterly.app",
    1,
    pastTimestamp,
    pastTimestamp,
    "owner",
    pastTimestamp
  );
  insertUser.run(
    "tenant-001",
    "Demo Tenant",
    "tenant@demo.meterly.app",
    1,
    pastTimestamp,
    pastTimestamp,
    "tenant",
    pastTimestamp
  );

  // Accounts (for auth)
  const insertAccount = db.prepare(
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertAccount.run(
    "acc-owner",
    "owner@demo.meterly.app",
    "credential",
    "owner-001",
    ownerHash,
    pastTimestamp,
    pastTimestamp
  );
  insertAccount.run(
    "acc-tenant",
    "tenant@demo.meterly.app",
    "credential",
    "tenant-001",
    tenantHash,
    pastTimestamp,
    pastTimestamp
  );

  // Property
  const insertProperty = db.prepare(
    `INSERT INTO properties (id, owner_id, name, address, has_solar, solar_gen_initial, solar_export_initial, solar_activated_at, payment_tracking_enabled, readings_require_approval, solo_mode, import_initial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertProperty.run(
    "prop-001",
    "owner-001",
    "Sunshine Residency",
    "12 Solar Street, Bandra, Mumbai",
    1,
    0,
    0,
    jan1,
    1,
    0,
    0,
    1000.0
  );

  // Tenancy
  const insertTenancy = db.prepare(
    `INSERT INTO tenancies (id, property_id, tenant_id, status, split_percentage, is_owner_tenancy, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertTenancy.run(
    "tenancy-001",
    "prop-001",
    "tenant-001",
    "active",
    100.0,
    0,
    jan1
  );

  // Property Rates
  const insertRate = db.prepare(
    `INSERT INTO property_rates (id, property_id, consumption_rate, export_rate, effective_from, created_by) VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertRate.run("rate-001", "prop-001", 9.5, 3.0, "2026-01", "owner-001");

  // Billing Periods, Readings, and Bills
  const insertPeriod = db.prepare(
    `INSERT INTO billing_periods (id, property_id, period_month, calculation_mode, status, submitted_by, confirmed_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertReading = db.prepare(
    `INSERT INTO meter_readings (id, billing_period_id, import_start, import_end, solar_generation_start, solar_generation_end, export_start, export_end, submitted_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertBill = db.prepare(
    `INSERT INTO bills (id, billing_period_id, tenancy_id, grid_imported, solar_generated, grid_exported, solar_self_consumed, total_consumption, split_percentage, tenant_consumption, consumption_rate, consumption_cost, export_rate, export_refund, custom_charges_total, total_due, status, marked_paid_at, marked_paid_by, snapshot_property_name, snapshot_property_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const periods = [
    { m: "01", iS: 1000.0, iE: 1312.0, sS: 0.0, sE: 185.0, eS: 0.0, eE: 62.0 },
    {
      m: "02",
      iS: 1312.0,
      iE: 1598.0,
      sS: 185.0,
      sE: 360.0,
      eS: 62.0,
      eE: 115.0,
    },
    {
      m: "03",
      iS: 1598.0,
      iE: 1887.0,
      sS: 360.0,
      sE: 552.0,
      eS: 115.0,
      eE: 178.0,
    },
    {
      m: "04",
      iS: 1887.0,
      iE: 2156.0,
      sS: 552.0,
      sE: 740.0,
      eS: 178.0,
      eE: 238.0,
    },
    {
      m: "05",
      iS: 2156.0,
      iE: 2389.0,
      sS: 740.0,
      sE: 918.0,
      eS: 238.0,
      eE: 295.0,
    },
    {
      m: "06",
      iS: 2389.0,
      iE: 2601.0,
      sS: 918.0,
      sE: 1092.0,
      eS: 295.0,
      eE: 349.0,
    },
  ];

  for (let idx = 0; idx < periods.length; idx++) {
    const p = periods[idx];
    const periodId = `period-2026-${p.m}`;
    const readingId = `reading-2026-${p.m}`;
    const billId = `bill-2026-${p.m}`;

    // ponytail: prop-001 has_solar = 1, so the correct mode is 'solar' rather than 'standard' (which fails CHECK constraint).
    insertPeriod.run(
      periodId,
      "prop-001",
      `2026-${p.m}`,
      "solar",
      "confirmed",
      "owner-001",
      "owner-001"
    );
    insertReading.run(
      readingId,
      periodId,
      p.iS,
      p.iE,
      p.sS,
      p.sE,
      p.eS,
      p.eE,
      "owner-001",
      1
    );

    const grid_imported = p.iE - p.iS;
    const solar_generated = p.sE - p.sS;
    const grid_exported = p.eE - p.eS;
    const solar_self_consumed = solar_generated - grid_exported;
    const total_consumption = grid_imported + solar_self_consumed;
    const split_percentage = 100.0;
    const tenant_consumption = total_consumption * 1.0;
    const consumption_rate = 9.5;
    const consumption_cost = tenant_consumption * 9.5;
    const export_rate = 3.0;
    const export_refund = grid_exported * 3.0 * 1.0;
    const custom_charges_total = 0;
    const total_due = consumption_cost - export_refund;

    const status = p.m === "05" || p.m === "06" ? "pending" : "paid";
    const markedPaidAt = status === "paid" ? pastTimestamp : null;
    const markedPaidBy = status === "paid" ? "owner-001" : null;

    insertBill.run(
      billId,
      periodId,
      "tenancy-001",
      grid_imported,
      solar_generated,
      grid_exported,
      solar_self_consumed,
      total_consumption,
      split_percentage,
      tenant_consumption,
      consumption_rate,
      consumption_cost,
      export_rate,
      export_refund,
      custom_charges_total,
      total_due,
      status,
      markedPaidAt,
      markedPaidBy,
      "Sunshine Residency",
      "12 Solar Street, Bandra, Mumbai"
    );
  }

  // Notifications
  const insertNotification = db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertNotification.run(
    "notif-1",
    "owner-001",
    "system",
    "Welcome to Meterly",
    "Your account has been created.",
    pastTimestamp
  );
  insertNotification.run(
    "notif-2",
    "owner-001",
    "payment_received",
    "Bill Paid",
    "Tenant paid the April bill.",
    pastTimestamp
  );
  insertNotification.run(
    "notif-3",
    "owner-001",
    "bill_generated",
    "Bill Generated",
    "June bill is ready.",
    pastTimestamp
  );

  console.log("Database seeded successfully.");
}

run().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
