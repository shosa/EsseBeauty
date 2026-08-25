ALTER TABLE "review_invitations" ADD COLUMN "delivery_claim_id" uuid;--> statement-breakpoint
ALTER TABLE "review_invitations" ADD COLUMN "delivery_lease_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "review_invitations_recovery_idx" ON "review_invitations" USING btree ("delivery_status", "delivery_lease_expires_at", "expires_at");
