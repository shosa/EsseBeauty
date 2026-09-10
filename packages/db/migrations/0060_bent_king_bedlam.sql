CREATE TYPE "public"."reward_type" AS ENUM('free_treatment', 'free_product', 'fixed_discount', 'percent_discount', 'credit');--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD COLUMN "applied_type" "reward_type";--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD COLUMN "applied_discount_cents" integer;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD COLUMN "applied_service_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD COLUMN "applied_product_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD COLUMN "type" "reward_type" DEFAULT 'fixed_discount' NOT NULL;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD COLUMN "discount_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD COLUMN "min_spend_cents" integer;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD COLUMN "max_discount_cents" integer;--> statement-breakpoint
ALTER TABLE "purchase_vouchers" ADD COLUMN "source_reward_redemption_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_applied_service_id_services_id_fk" FOREIGN KEY ("applied_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_applied_product_id_inventory_products_id_fk" FOREIGN KEY ("applied_product_id") REFERENCES "public"."inventory_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_source_reward_redemption_id_loyalty_reward_redemptions_id_fk" FOREIGN KEY ("source_reward_redemption_id") REFERENCES "public"."loyalty_reward_redemptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_min_spend_non_negative" CHECK ("loyalty_rewards"."min_spend_cents" IS NULL OR "loyalty_rewards"."min_spend_cents" >= 0);--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_max_discount_non_negative" CHECK ("loyalty_rewards"."max_discount_cents" IS NULL OR "loyalty_rewards"."max_discount_cents" >= 0);