ALTER TABLE "salon_special_openings" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "salon_special_openings" ALTER COLUMN "end_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "salon_special_opening_staff" ADD COLUMN "periods" jsonb;--> statement-breakpoint
ALTER TABLE "salon_special_openings" ADD COLUMN "periods" jsonb;