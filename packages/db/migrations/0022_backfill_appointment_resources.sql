WITH unique_service_resources AS (
  SELECT
    "salon_id",
    "service_id",
    min("resource_id"::text)::uuid AS "resource_id"
  FROM "service_resources"
  GROUP BY "salon_id", "service_id"
  HAVING count(*) = 1
)
UPDATE "appointments" AS appointment
SET "resource_id" = mapping."resource_id"
FROM unique_service_resources AS mapping
WHERE appointment."resource_id" IS NULL
  AND appointment."salon_id" = mapping."salon_id"
  AND appointment."service_id" = mapping."service_id";
