ALTER TABLE "review_invitation_deliveries" DROP CONSTRAINT "review_invitation_deliveries_channel_check";--> statement-breakpoint
ALTER TABLE "review_request_settings" DROP CONSTRAINT "review_request_settings_channels_check";--> statement-breakpoint
ALTER TABLE "review_invitation_deliveries" ADD CONSTRAINT "review_invitation_deliveries_channel_check" CHECK ("review_invitation_deliveries"."channel"::text in ('email','whatsapp','app'));--> statement-breakpoint
ALTER TABLE "review_request_settings" ADD CONSTRAINT "review_request_settings_channels_check" CHECK (jsonb_array_length("review_request_settings"."channels") > 0 and "review_request_settings"."channels" <@ '["email","whatsapp","app"]'::jsonb);
