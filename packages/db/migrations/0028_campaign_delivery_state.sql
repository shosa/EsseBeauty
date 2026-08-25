ALTER TYPE "campaign_status" ADD VALUE IF NOT EXISTS 'queued';--> statement-breakpoint
ALTER TYPE "campaign_status" ADD VALUE IF NOT EXISTS 'processing';--> statement-breakpoint
ALTER TYPE "campaign_status" ADD VALUE IF NOT EXISTS 'partial';--> statement-breakpoint
ALTER TYPE "campaign_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD COLUMN "provider_name" text;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD COLUMN "delivery_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_delivery_attempts_non_negative" CHECK ("delivery_attempts" >= 0);--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_status_valid" CHECK ("status" IN ('pending', 'queued', 'processing', 'sent', 'failed', 'cancelled'));--> statement-breakpoint
CREATE INDEX "campaign_recipients_campaign_status_idx" ON "campaign_recipients" USING btree ("campaign_id", "status");
