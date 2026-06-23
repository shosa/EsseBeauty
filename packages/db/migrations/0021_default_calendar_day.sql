ALTER TABLE "calendar_settings" ALTER COLUMN "default_view" SET DEFAULT 'day';
UPDATE "calendar_settings" SET "default_view" = 'day' WHERE "default_view" = 'week';
