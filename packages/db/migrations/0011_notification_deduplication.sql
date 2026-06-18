CREATE UNIQUE INDEX "notifications_entity_role_type_unique"
ON "notifications" USING btree ("salon_id", "entity_id", "target_role", "type");
