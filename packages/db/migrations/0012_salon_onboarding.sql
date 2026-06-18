ALTER TABLE "salons" ADD COLUMN "onboarding_step" integer DEFAULT 1 NOT NULL;
ALTER TABLE "salons" ADD COLUMN "onboarding_completed_at" timestamp with time zone;
