CREATE TABLE IF NOT EXISTS "cash_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "direction" text NOT NULL,
  "payment_method" "payment_method" NOT NULL,
  "amount_cents" integer NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "reason" text NOT NULL,
  "category" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" uuid,
  "idempotency_key" text NOT NULL,
  "created_by_user_id" uuid,
  "reversed_by_movement_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cash_movements_direction_valid" CHECK ("cash_movements"."direction" in ('in', 'out')),
  CONSTRAINT "cash_movements_amount_positive" CHECK ("cash_movements"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "inventory_expenses" ADD COLUMN IF NOT EXISTS "cash_movement_id" uuid;
--> statement-breakpoint
ALTER TABLE "inventory_expenses" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN IF NOT EXISTS "cash_movement_id" uuid;
--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN IF NOT EXISTS "location" text;
--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN IF NOT EXISTS "disposed_by_user_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_reversed_by_movement_id_cash_movements_id_fk" FOREIGN KEY ("reversed_by_movement_id") REFERENCES "public"."cash_movements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_expenses" ADD CONSTRAINT "inventory_expenses_cash_movement_id_cash_movements_id_fk" FOREIGN KEY ("cash_movement_id") REFERENCES "public"."cash_movements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_cash_movement_id_cash_movements_id_fk" FOREIGN KEY ("cash_movement_id") REFERENCES "public"."cash_movements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_disposed_by_user_id_users_id_fk" FOREIGN KEY ("disposed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_expenses" ADD CONSTRAINT "inventory_expenses_cash_movement_salon_id_fk" FOREIGN KEY ("cash_movement_id","salon_id") REFERENCES "public"."cash_movements"("id","salon_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_cash_movement_salon_id_fk" FOREIGN KEY ("cash_movement_id","salon_id") REFERENCES "public"."cash_movements"("id","salon_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cash_movements_salon_idempotency_unique" ON "cash_movements" USING btree ("salon_id","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cash_movements_id_salon_unique" ON "cash_movements" USING btree ("id","salon_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_expenses_salon_idempotency_unique" ON "inventory_expenses" USING btree ("salon_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_assets_salon_idempotency_unique" ON "inventory_assets" USING btree ("salon_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;
