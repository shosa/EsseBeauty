ALTER TABLE "customers"
  ADD COLUMN "first_name" text;

--> statement-breakpoint

ALTER TABLE "customers"
  ADD COLUMN "last_name" text;

--> statement-breakpoint

UPDATE "customers"
SET
  "first_name" = COALESCE(NULLIF(split_part(trim("full_name"), ' ', 1), ''), 'Cliente'),
  "last_name" = COALESCE(NULLIF(regexp_replace(trim("full_name"), '^\S+\s*', ''), ''), '')
WHERE "first_name" IS NULL
   OR "last_name" IS NULL;

--> statement-breakpoint

ALTER TABLE "customers"
  ALTER COLUMN "first_name" SET NOT NULL;

--> statement-breakpoint

ALTER TABLE "customers"
  ALTER COLUMN "last_name" SET NOT NULL;

--> statement-breakpoint

ALTER TABLE "customers"
  ALTER COLUMN "first_name" SET DEFAULT '';

--> statement-breakpoint

ALTER TABLE "customers"
  ALTER COLUMN "last_name" SET DEFAULT '';
