CREATE TABLE "platform_email_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text DEFAULT 'smtp' NOT NULL,
  "host" text DEFAULT '' NOT NULL,
  "port" integer DEFAULT 587 NOT NULL,
  "secure" boolean DEFAULT false NOT NULL,
  "username" text,
  "password_encrypted" text,
  "default_from_name" text DEFAULT 'EsseBeauty' NOT NULL,
  "default_from_email" text DEFAULT 'noreply@essebeauty.app' NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "last_health_check_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
