ALTER TABLE "salons"
ALTER COLUMN "plan_id" TYPE text
USING "plan_id"::text;
