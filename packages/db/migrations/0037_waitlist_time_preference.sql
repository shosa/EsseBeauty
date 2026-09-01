ALTER TABLE "waitlist_entries"
  ADD COLUMN "time_preference" text DEFAULT 'any' NOT NULL;

ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_time_preference_check"
  CHECK ("time_preference" IN ('any', 'morning', 'afternoon', 'evening'));
