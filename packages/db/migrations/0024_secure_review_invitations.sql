CREATE TYPE "public"."review_delivery_channel"
AS ENUM(
  'email',
  'sms',
  'whatsapp'
);
--> statement-breakpoint

CREATE TYPE "public"."review_delivery_status"
AS ENUM(
  'pending',
  'processing',
  'sent',
  'failed',
  'skipped',
  'exhausted',
  'queued',
  'scheduled',
  'delivered'
);
--> statement-breakpoint

CREATE TABLE "review_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "appointment_id" uuid NOT NULL,
  "token_hash" text,
  "channel" "review_delivery_channel" NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "delivery_status" "review_delivery_status" DEFAULT 'pending' NOT NULL,
  "delivery_attempts" integer DEFAULT 0 NOT NULL,
  "last_delivery_attempt_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "delivery_failure" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "review_invitations_token_hash_format"
    CHECK (
      "review_invitations"."token_hash" IS NULL
      OR "review_invitations"."token_hash" ~ '^[a-f0-9]{64}$'
    ),

  CONSTRAINT "review_invitations_delivery_attempts_non_negative"
    CHECK ("review_invitations"."delivery_attempts" >= 0)
);
--> statement-breakpoint

ALTER TABLE "review_invitations"
ADD CONSTRAINT "review_invitations_salon_id_salons_id_fk"
FOREIGN KEY ("salon_id")
REFERENCES "public"."salons"("id")
ON DELETE cascade
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "review_invitations"
ADD CONSTRAINT "review_invitations_appointment_id_appointments_id_fk"
FOREIGN KEY ("appointment_id")
REFERENCES "public"."appointments"("id")
ON DELETE cascade
ON UPDATE no action;
--> statement-breakpoint

CREATE UNIQUE INDEX "review_invitations_appointment_unique"
ON "review_invitations" USING btree ("appointment_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "review_invitations_token_hash_unique"
ON "review_invitations" USING btree ("token_hash");