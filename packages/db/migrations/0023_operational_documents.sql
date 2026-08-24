CREATE TYPE "public"."consent_delivery_channel" AS ENUM('email', 'sms', 'in_person');--> statement-breakpoint
ALTER TABLE "customer_consents" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD COLUMN "delivery_channel" "consent_delivery_channel";--> statement-breakpoint
ALTER TABLE "customer_consents" ADD COLUMN "signer_name" text;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD COLUMN "document_hash" text;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD COLUMN "revoked_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_consents_salon_token_hash_unique" ON "customer_consents" USING btree ("salon_id", "token_hash");--> statement-breakpoint
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_token_hash_format" CHECK ("token_hash" IS NULL OR "token_hash" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_document_hash_format" CHECK ("document_hash" IS NULL OR "document_hash" ~ '^[a-f0-9]{64}$');
