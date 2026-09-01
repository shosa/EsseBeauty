CREATE TABLE "review_request_settings" (
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

CREATE TABLE "review_invitation_deliveries" (
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
  "status" "review_delivery_status" DEFAULT 'scheduled' NOT NULL,
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

CREATE INDEX "review_invitation_deliveries_schedule_idx"
ON "review_invitation_deliveries" ("status", "scheduled_at");