ALTER TABLE "campaign_templates" ALTER COLUMN "channel" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "channel" SET DATA TYPE text;--> statement-breakpoint
UPDATE "campaign_templates" SET "channel" = 'email' WHERE "channel" = 'sms';--> statement-breakpoint
UPDATE "marketing_campaigns" SET "channel" = 'email' WHERE "channel" = 'sms';--> statement-breakpoint
DROP TYPE "public"."campaign_channel";--> statement-breakpoint
CREATE TYPE "public"."campaign_channel" AS ENUM('email', 'whatsapp', 'app');--> statement-breakpoint
ALTER TABLE "campaign_templates" ALTER COLUMN "channel" SET DATA TYPE "public"."campaign_channel" USING "channel"::"public"."campaign_channel";--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "channel" SET DATA TYPE "public"."campaign_channel" USING "channel"::"public"."campaign_channel";