CREATE TABLE IF NOT EXISTS "salon_closures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE cascade,
  "date" text NOT NULL,
  "reason" text,
  "recurring_yearly" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "salon_closures_salon_date_unique"
  ON "salon_closures" ("salon_id", "date");
