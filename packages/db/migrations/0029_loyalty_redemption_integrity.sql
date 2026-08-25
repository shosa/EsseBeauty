ALTER TABLE "loyalty_reward_redemptions" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_redemptions_points_positive" CHECK ("loyalty_reward_redemptions"."points_spent" > 0);--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_redemptions_salon_idempotency_unique" ON "loyalty_reward_redemptions" USING btree ("salon_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_points_redemption_unique" ON "loyalty_points" USING btree ("redemption_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_tiers_salon_threshold_unique" ON "loyalty_tiers" USING btree ("salon_id","min_points");--> statement-breakpoint
ALTER TABLE "loyalty_tiers" ADD CONSTRAINT "loyalty_tiers_min_points_non_negative" CHECK ("loyalty_tiers"."min_points" >= 0);
