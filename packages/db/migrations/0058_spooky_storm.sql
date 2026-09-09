ALTER TABLE "salon_special_openings" ALTER COLUMN "periods" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "salon_special_opening_staff" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "salon_special_opening_staff" DROP COLUMN "end_time";--> statement-breakpoint
ALTER TABLE "salon_special_openings" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "salon_special_openings" DROP COLUMN "end_time";