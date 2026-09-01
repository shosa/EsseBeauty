
CREATE TYPE "communication_provider" AS ENUM ('meta_cloud_api');--> statement-breakpoint
CREATE TYPE "communication_provider_status" AS ENUM ('not_configured', 'pending_verification', 'ready', 'degraded', 'revoked', 'disabled');--> statement-breakpoint
CREATE TYPE "communication_secret_kind" AS ENUM ('access_token', 'webhook_verify_token');--> statement-breakpoint
CREATE TYPE "communication_channel" AS ENUM ('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "communication_consent_purpose" AS ENUM ('marketing', 'transactional');--> statement-breakpoint
CREATE TYPE "communication_consent_status" AS ENUM ('granted', 'revoked');--> statement-breakpoint
CREATE TYPE "communication_conversation_status" AS ENUM ('open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "communication_direction" AS ENUM ('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "communication_message_kind" AS ENUM ('text', 'template', 'media', 'system');--> statement-breakpoint
CREATE TYPE "communication_message_status" AS ENUM ('queued', 'accepted', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "communication_outbox_status" AS ENUM ('pending', 'processing', 'delivered', 'failed', 'exhausted');--> statement-breakpoint
CREATE TABLE "communication_provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"provider" "communication_provider" DEFAULT 'meta_cloud_api' NOT NULL,
	"waba_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"display_phone_number" text,
	"business_portfolio_id" text,
	"graph_api_version" text DEFAULT 'v23.0' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"status" "communication_provider_status" DEFAULT 'not_configured' NOT NULL,
	"webhook_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"webhook_subscription_status" text DEFAULT 'not_subscribed' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"last_health_check_at" timestamp with time zone,
	"last_webhook_at" timestamp with time zone,
	"last_error_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "communication_provider_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" "communication_secret_kind" NOT NULL,
	"ciphertext" text NOT NULL,
	"initialization_vector" text NOT NULL,
	"authentication_tag" text NOT NULL,
	"key_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "communication_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"purpose" "communication_consent_purpose" NOT NULL,
	"status" "communication_consent_status" NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"captured_source" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "communication_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"customer_id" uuid,
	"participant_phone" text NOT NULL,
	"status" "communication_conversation_status" DEFAULT 'open' NOT NULL,
	"assigned_user_id" uuid,
	"last_message_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"last_message_preview" text,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_conversations_unread_non_negative" CHECK ("unread_count" >= 0)
);--> statement-breakpoint
CREATE TABLE "communication_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" "communication_direction" NOT NULL,
	"kind" "communication_message_kind" NOT NULL,
	"body" text,
	"template_name" text,
	"template_locale" text,
	"template_parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_message_id" text,
	"client_idempotency_key" text,
	"source_type" text,
	"source_id" uuid,
	"actor_user_id" uuid,
	"status" "communication_message_status" DEFAULT 'queued' NOT NULL,
	"provider_timestamp" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "communication_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"status" "communication_outbox_status" DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error_code" text,
	"delivered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_outbox_attempts_non_negative" CHECK ("attempts" >= 0),
	CONSTRAINT "communication_outbox_max_attempts_positive" CHECK ("max_attempts" > 0),
	CONSTRAINT "communication_outbox_attempts_bounded" CHECK ("attempts" <= "max_attempts")
);--> statement-breakpoint
CREATE TABLE "communication_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"redacted_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "communication_user_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"last_read_message_id" uuid,
	"muted" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"draft" text DEFAULT '' NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"last_opened_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "communication_provider_accounts" ADD CONSTRAINT "communication_provider_accounts_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_provider_secrets" ADD CONSTRAINT "communication_provider_secrets_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_provider_secrets" ADD CONSTRAINT "communication_provider_secrets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."communication_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."communication_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."communication_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."communication_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_outbox" ADD CONSTRAINT "communication_outbox_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_outbox" ADD CONSTRAINT "communication_outbox_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."communication_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_webhook_events" ADD CONSTRAINT "communication_webhook_events_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_webhook_events" ADD CONSTRAINT "communication_webhook_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."communication_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_user_state" ADD CONSTRAINT "communication_user_state_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_user_state" ADD CONSTRAINT "communication_user_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_user_state" ADD CONSTRAINT "communication_user_state_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."communication_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_user_state" ADD CONSTRAINT "communication_user_state_last_read_message_id_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."communication_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communication_provider_accounts_salon_provider_unique" ON "communication_provider_accounts" USING btree ("salon_id", "provider");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_provider_accounts_waba_unique" ON "communication_provider_accounts" USING btree ("waba_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_provider_accounts_phone_unique" ON "communication_provider_accounts" USING btree ("phone_number_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_provider_accounts_webhook_key_unique" ON "communication_provider_accounts" USING btree ("webhook_key");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_provider_secrets_account_kind_unique" ON "communication_provider_secrets" USING btree ("account_id", "kind");--> statement-breakpoint
CREATE INDEX "communication_provider_secrets_salon_account_idx" ON "communication_provider_secrets" USING btree ("salon_id", "account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_consents_scope_unique" ON "communication_consents" USING btree ("salon_id", "customer_id", "channel", "purpose");--> statement-breakpoint
CREATE INDEX "communication_consents_marketing_lookup_idx" ON "communication_consents" USING btree ("salon_id", "channel", "purpose", "status");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_conversations_account_participant_unique" ON "communication_conversations" USING btree ("account_id", "participant_phone");--> statement-breakpoint
CREATE INDEX "communication_conversations_salon_activity_idx" ON "communication_conversations" USING btree ("salon_id", "last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_messages_provider_id_unique" ON "communication_messages" USING btree ("account_id", "provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_messages_idempotency_unique" ON "communication_messages" USING btree ("account_id", "client_idempotency_key");--> statement-breakpoint
CREATE INDEX "communication_messages_conversation_created_idx" ON "communication_messages" USING btree ("conversation_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_outbox_message_unique" ON "communication_outbox" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "communication_outbox_claim_idx" ON "communication_outbox" USING btree ("status", "available_at", "lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_webhook_events_dedupe_unique" ON "communication_webhook_events" USING btree ("account_id", "external_event_id");--> statement-breakpoint
CREATE INDEX "communication_webhook_events_pending_idx" ON "communication_webhook_events" USING btree ("status", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_user_state_scope_unique" ON "communication_user_state" USING btree ("salon_id", "user_id", "conversation_id");--> statement-breakpoint
CREATE INDEX "communication_user_state_selected_idx" ON "communication_user_state" USING btree ("salon_id", "user_id", "selected");
