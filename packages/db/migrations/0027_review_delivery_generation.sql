ALTER TABLE "review_invitations" ADD COLUMN "delivery_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_delivery_generation_non_negative" CHECK ("review_invitations"."delivery_generation" >= 0);
