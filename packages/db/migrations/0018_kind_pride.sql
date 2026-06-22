CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'sparkles' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_salon_name_unique" ON "service_categories" USING btree ("salon_id","name");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "service_categories" ("salon_id", "name", "icon", "display_order")
SELECT
	"salon_id",
	"category",
	CASE
		WHEN lower("category") LIKE '%capell%' OR lower("category") LIKE '%parruc%' THEN 'scissors'
		WHEN lower("category") LIKE '%barb%' THEN 'brush'
		WHEN lower("category") LIKE '%ungh%' OR lower("category") LIKE '%nail%' OR lower("category") LIKE '%mani%' OR lower("category") LIKE '%pied%' OR lower("category") LIKE '%manicure%' OR lower("category") LIKE '%pedicure%' THEN 'hand'
		WHEN lower("category") = 'colore' OR lower("category") LIKE '%trucc%' OR lower("category") LIKE '%make%' THEN 'palette'
		WHEN lower("category") LIKE '%viso%' OR lower("category") LIKE '%facial%' THEN 'sparkles'
		WHEN lower("category") LIKE '%massagg%' OR lower("category") LIKE '%benessere%' OR lower("category") LIKE '%spa%' THEN 'flower-2'
		WHEN lower("category") LIKE '%depil%' OR lower("category") LIKE '%cerett%' OR lower("category") LIKE '%laser%' THEN 'zap'
		ELSE 'sparkles'
	END,
	(row_number() OVER (PARTITION BY "salon_id" ORDER BY "category") - 1)::integer
FROM "services"
GROUP BY "salon_id", "category";--> statement-breakpoint
UPDATE "services"
SET "category_id" = "service_categories"."id"
FROM "service_categories"
WHERE "services"."salon_id" = "service_categories"."salon_id"
	AND "services"."category" = "service_categories"."name";
