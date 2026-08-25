ALTER TABLE "reminder_settings" RENAME COLUMN "sms_enabled" TO "whatsapp_enabled";--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD COLUMN "whatsapp_template_name" text;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD COLUMN "whatsapp_template_locale" text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "whatsapp_template_name" text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "whatsapp_template_locale" text;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD COLUMN "whatsapp_template_parameters" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
COMMENT ON COLUMN "customers"."marketing_sms_consent" IS 'Historical SMS consent only. New WhatsApp marketing eligibility is recorded in communication_consents.';--> statement-breakpoint
COMMENT ON COLUMN "reminders"."channel" IS 'Historical SMS reminder rows remain truthful. New reminder writes use whatsapp or email.';--> statement-breakpoint
COMMENT ON COLUMN "review_invitations"."channel" IS 'Historical SMS review rows remain truthful. New fallback writes use whatsapp.';--> statement-breakpoint
COMMENT ON COLUMN "marketing_campaigns"."channel" IS 'Historical SMS campaigns remain read-only. New WhatsApp campaigns require an approved template.';
