INSERT INTO "salon_locations" (
  "salon_id",
  "name",
  "address",
  "phone",
  "email",
  "timezone",
  "active",
  "display_order"
)
SELECT
  s."id",
  'Sede principale',
  s."address",
  s."phone",
  s."email",
  s."timezone",
  true,
  0
FROM "salons" s
WHERE NOT EXISTS (
  SELECT 1
  FROM "salon_locations" l
  WHERE l."salon_id" = s."id"
);
--> statement-breakpoint
UPDATE "staff" st
SET "location_id" = locations."id"
FROM (
  SELECT DISTINCT ON ("salon_id") "id", "salon_id"
  FROM "salon_locations"
  WHERE "active" = true
  ORDER BY "salon_id", "display_order", "created_at"
) locations
WHERE st."salon_id" = locations."salon_id"
  AND st."location_id" IS NULL;
--> statement-breakpoint
UPDATE "appointments" appointment
SET "location_id" = st."location_id"
FROM "staff" st
WHERE appointment."staff_id" = st."id"
  AND appointment."location_id" IS NULL
  AND st."location_id" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "service_staff" ("salon_id", "service_id", "staff_id")
SELECT service."salon_id", service."id", member."id"
FROM "services" service
INNER JOIN "staff" member
  ON member."salon_id" = service."salon_id"
  AND member."active" = true
WHERE service."active" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "service_staff" existing
    WHERE existing."service_id" = service."id"
  )
ON CONFLICT DO NOTHING;
