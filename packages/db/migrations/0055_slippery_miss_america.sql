ALTER TABLE "review_invitation_deliveries" DROP CONSTRAINT "review_invitation_deliveries_channel_check";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "birthday" text;--> statement-breakpoint
ALTER TABLE "review_invitation_deliveries" ADD CONSTRAINT "review_invitation_deliveries_channel_check" CHECK ("review_invitation_deliveries"."channel"::text in ('email','whatsapp','app'));