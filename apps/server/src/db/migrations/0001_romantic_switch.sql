CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`icon_url` text,
	`is_hidden` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dish_categories` (
	`dish_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`dish_id`, `category_id`),
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dish_modifiers` (
	`dish_id` integer NOT NULL,
	`modifier_id` integer NOT NULL,
	`modifier_group_id` integer NOT NULL,
	PRIMARY KEY(`dish_id`, `modifier_id`),
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modifier_id`) REFERENCES `modifiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modifier_group_id`) REFERENCES `modifier_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `modifier_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`min_selections` integer,
	`max_selections` integer,
	`display_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `modifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price_adjustment` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_item_modifiers` (
	`order_item_id` integer NOT NULL,
	`modifier_id` integer NOT NULL,
	`name` text NOT NULL,
	`price_at_order` integer NOT NULL,
	PRIMARY KEY(`order_item_id`, `modifier_id`),
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modifier_id`) REFERENCES `modifiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `operating_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_of_week` integer NOT NULL,
	`open_time` text NOT NULL,
	`close_time` text NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operating_hours_day_of_week_unique` ON `operating_hours` (`day_of_week`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`party_size` integer NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_email` text,
	`notes` text,
	`status` text NOT NULL,
	`assigned_table_ids` text,
	`decline_reason` text,
	`confirmed_at` integer,
	`seated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reservations_date_time_idx` ON `reservations` (`date`,`time`);--> statement-breakpoint
CREATE INDEX `reservations_status_idx` ON `reservations` (`status`);--> statement-breakpoint
CREATE TABLE `shift_staff` (
	`shift_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`shift_id`, `user_id`),
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_type` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`total_orders` integer,
	`total_revenue` integer,
	`notes` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shifts_start_time_idx` ON `shifts` (`start_time`);--> statement-breakpoint
CREATE INDEX `shifts_end_time_idx` ON `shifts` (`end_time`);--> statement-breakpoint
CREATE TABLE `dish_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dish_id` integer NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `variant_recipes` (
	`variant_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`quantity_required` integer NOT NULL,
	PRIMARY KEY(`variant_id`, `ingredient_id`),
	FOREIGN KEY (`variant_id`) REFERENCES `dish_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `dishes` ADD `is_hidden` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `is_recommended` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `is_chef_special` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `order_priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `variant_id` integer REFERENCES dish_variants(id);--> statement-breakpoint
ALTER TABLE `order_items` ADD `special_request` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shift_id` integer REFERENCES shifts(id);