CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `otp_rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `otp_rate_limit_email_unique` ON `otp_rate_limit` (`email`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user_created` ON `session` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`theme` text DEFAULT 'system',
	`primary_role` text,
	`onboarding_completed_at` integer,
	`onboarding_checklist` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`has_solar` integer DEFAULT false,
	`solar_gen_initial` real DEFAULT 0,
	`solar_export_initial` real DEFAULT 0,
	`solar_activated_at` integer,
	`payment_tracking_enabled` integer DEFAULT true,
	`readings_require_approval` integer DEFAULT false,
	`max_pending_edit_requests` integer DEFAULT 3,
	`reading_reminder_day` integer DEFAULT 5,
	`solo_mode` integer DEFAULT false,
	`solo_mode_changed_at` integer,
	`import_initial` real,
	`archived_at` integer,
	`meter_max_reading` integer DEFAULT 10000000,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenancies` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`tenant_id` text,
	`invite_email` text,
	`invite_token` text,
	`status` text NOT NULL,
	`split_percentage` real,
	`is_owner_tenancy` integer DEFAULT false,
	`invited_at` integer,
	`invite_expires_at` integer,
	`joined_at` integer,
	`left_at` integer,
	`declined_at` integer,
	`archived_by_tenant_at` integer,
	`removal_reason` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenancies_invite_token_unique` ON `tenancies` (`invite_token`);--> statement-breakpoint
CREATE INDEX `idx_tenancies_property_status` ON `tenancies` (`property_id`,`status`);--> statement-breakpoint
CREATE TABLE `property_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`consumption_rate` real NOT NULL,
	`export_rate` real NOT NULL,
	`effective_from` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `custom_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`charged_to_tenant` integer DEFAULT true,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `billing_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`period_month` text NOT NULL,
	`calculation_mode` text NOT NULL,
	`status` text NOT NULL,
	`submitted_by` text,
	`submitted_at` integer,
	`confirmed_by` text,
	`confirmed_at` integer,
	`rate_override` text,
	`one_off_charges` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_billing_periods_property_month` ON `billing_periods` (`property_id`,`period_month`);--> statement-breakpoint
CREATE TABLE `meter_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`billing_period_id` text NOT NULL,
	`solar_generation_start` real DEFAULT 0,
	`solar_generation_end` real NOT NULL,
	`export_start` real DEFAULT 0,
	`export_end` real NOT NULL,
	`import_start` real DEFAULT 0,
	`import_end` real NOT NULL,
	`submitted_by` text NOT NULL,
	`version` integer DEFAULT 1,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meter_readings_billing_period_id_unique` ON `meter_readings` (`billing_period_id`);--> statement-breakpoint
CREATE TABLE `meter_reading_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`meter_reading_id` text NOT NULL,
	`edited_by` text NOT NULL,
	`reason` text NOT NULL,
	`old_values` text NOT NULL,
	`new_values` text NOT NULL,
	`version_before` integer NOT NULL,
	`version_after` integer NOT NULL,
	`affected_periods` text,
	`edited_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`meter_reading_id`) REFERENCES `meter_readings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `edit_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`billing_period_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`reason` text NOT NULL,
	`proposed_values` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`review_note` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`billing_period_id` text NOT NULL,
	`tenancy_id` text NOT NULL,
	`solar_generated` real,
	`grid_exported` real,
	`grid_imported` real,
	`solar_self_consumed` real,
	`total_consumption` real,
	`split_percentage` real,
	`tenant_consumption` real,
	`consumption_rate` real,
	`consumption_cost` real,
	`export_rate` real,
	`export_refund` real,
	`custom_charges_json` text,
	`custom_charges_total` real,
	`total_due` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`marked_paid_at` integer,
	`marked_paid_by` text,
	`snapshot_property_name` text,
	`snapshot_property_address` text,
	`recalculated_at` integer,
	`recalculation_count` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`marked_paid_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bills_tenancy_period` ON `bills` (`tenancy_id`,`billing_period_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`metadata` text,
	`read_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `bill_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`billing_period_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`object_key` text NOT NULL,
	`purpose` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`edit_request_id` text,
	`uploaded_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edit_request_id`) REFERENCES `edit_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_photos_object_key_unique` ON `bill_photos` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_bill_photos_period_purpose_user` ON `bill_photos` (`billing_period_id`,`purpose`,`uploaded_by`);--> statement-breakpoint
CREATE INDEX `idx_bill_photos_property` ON `bill_photos` (`property_id`);
--> statement-breakpoint
CREATE TABLE `password_change_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_change_limit_user_id_unique` ON `password_change_limit` (`user_id`);