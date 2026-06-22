ALTER TABLE "salons" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "country" text DEFAULT 'Italia';--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "longitude" double precision;