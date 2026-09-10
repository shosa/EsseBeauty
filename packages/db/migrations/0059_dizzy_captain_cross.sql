ALTER TABLE "salon_locations" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "salon_locations" SET "is_default" = true WHERE "id" IN (
  SELECT DISTINCT ON ("salon_id") "id" FROM "salon_locations"
  ORDER BY "salon_id", "display_order" ASC, "created_at" ASC
);