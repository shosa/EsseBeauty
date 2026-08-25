ALTER TYPE "reminder_status" ADD VALUE IF NOT EXISTS 'queued';--> statement-breakpoint
ALTER TYPE "review_delivery_status" ADD VALUE IF NOT EXISTS 'queued';--> statement-breakpoint
CREATE TYPE "whatsapp_template_approval_status" AS ENUM ('pending', 'approved', 'rejected', 'revoked');--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD COLUMN "whatsapp_approval_status" "whatsapp_template_approval_status";--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD COLUMN "whatsapp_approval_source" text;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD COLUMN "whatsapp_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "whatsapp_template_approval_status" "whatsapp_template_approval_status";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP CONSTRAINT "campaign_recipients_status_valid";--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_status_valid" CHECK ("status" IN ('pending', 'queued', 'processing', 'sent', 'failed', 'skipped', 'cancelled'));
