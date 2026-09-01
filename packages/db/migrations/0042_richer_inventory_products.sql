ALTER TABLE inventory_products ADD COLUMN description text;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN brand text;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN manufacturer_code text;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN vat_rate_basis_points integer NOT NULL DEFAULT 2200;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN storage_location text;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN notes text;
