DELETE FROM "loyalty_points"
WHERE "appointment_id" IS NOT NULL
AND "id" IN (
	SELECT "id" FROM (
		SELECT "id", row_number() OVER (PARTITION BY "appointment_id" ORDER BY "created_at", "id") AS row_number
		FROM "loyalty_points"
		WHERE "appointment_id" IS NOT NULL
	) duplicate_points
	WHERE duplicate_points.row_number > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_points_appointment_unique" ON "loyalty_points" USING btree ("appointment_id");
