CREATE TABLE "loyalty_earning_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"action" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_earning_rules_points_non_negative" CHECK ("loyalty_earning_rules"."points" >= 0)
);
--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD COLUMN "rule_key" text;--> statement-breakpoint
ALTER TABLE "loyalty_earning_rules" ADD CONSTRAINT "loyalty_earning_rules_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_earning_rules_salon_action_unique" ON "loyalty_earning_rules" USING btree ("salon_id","action");--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_points_sale_rule_unique" ON "loyalty_points" USING btree ("sale_id","rule_key");
--> statement-breakpoint
INSERT INTO "loyalty_earning_rules" ("salon_id", "action", "points", "active")
SELECT "salon_id", 'appointment_completed', "points_per_appointment", true FROM "loyalty_settings"
ON CONFLICT ("salon_id", "action") DO NOTHING;
--> statement-breakpoint
INSERT INTO "loyalty_earning_rules" ("salon_id", "action", "points", "active")
SELECT "id", defaults.action, defaults.points, false
FROM "salons"
CROSS JOIN (VALUES ('service_purchased', 5), ('product_purchased', 1), ('euro_spent', 1)) AS defaults(action, points)
ON CONFLICT ("salon_id", "action") DO NOTHING;
