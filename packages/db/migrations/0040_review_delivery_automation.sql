CREATE TABLE IF NOT EXISTS "review_request_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
  "automatic_enabled" boolean DEFAULT false NOT NULL,
  "delay_preset" text DEFAULT 'one_hour' NOT NULL,
  "channels" jsonb DEFAULT '["email"]'::jsonb NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT "review_request_settings_salon_unique"
    UNIQUE ("salon_id"),

  CONSTRAINT "review_request_settings_delay_check"
    CHECK (
      "delay_preset" IN (
        'immediate',
        'one_hour',
        'three_hours',
        'next_day',
        'two_days'
      )
    ),

  CONSTRAINT "review_request_settings_channels_check"
    CHECK (
      jsonb_array_length("channels") > 0
      AND "channels" <@ '["email","whatsapp"]'::jsonb
    )
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "review_invitation_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  "invitation_id" uuid NOT NULL
    REFERENCES "review_invitations"("id")
    ON DELETE CASCADE,

  "salon_id" uuid NOT NULL
    REFERENCES "salons"("id")
    ON DELETE CASCADE,

  "channel" "review_delivery_channel" NOT NULL,
  "generation" integer DEFAULT 0 NOT NULL,
  "scheduled_at" timestamptz NOT NULL,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "delivered_at" timestamptz,
  "last_attempt_at" timestamptz,
  "failure_reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT "review_invitation_deliveries_identity_unique"
    UNIQUE ("invitation_id", "channel", "generation"),

  CONSTRAINT "review_invitation_deliveries_generation_check"
    CHECK ("generation" >= 0),

  CONSTRAINT "review_invitation_deliveries_attempts_check"
    CHECK ("attempts" >= 0),

  CONSTRAINT "review_invitation_deliveries_channel_check"
    CHECK ("channel" IN ('email', 'whatsapp'))
);

--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'review_invitation_deliveries'
      AND column_name = 'status'
      AND udt_name = 'review_delivery_status'
  ) THEN
    ALTER TABLE "review_invitation_deliveries"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE text USING "status"::text,
      ALTER COLUMN "status" SET DEFAULT 'scheduled';
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'review_invitation_deliveries_status_check'
      AND conrelid = 'public.review_invitation_deliveries'::regclass
  ) THEN
    ALTER TABLE "review_invitation_deliveries"
      ADD CONSTRAINT "review_invitation_deliveries_status_check"
      CHECK (
        "status" IN (
          'scheduled',
          'processing',
          'delivered',
          'queued',
          'failed',
          'skipped',
          'exhausted'
        )
      );
  END IF;
END $$;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "review_invitation_deliveries_schedule_idx"
ON "review_invitation_deliveries" ("status", "scheduled_at");
