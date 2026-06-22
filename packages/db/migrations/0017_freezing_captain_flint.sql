CREATE TABLE "customer_package_item_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"customer_package_id" uuid NOT NULL,
	"package_item_id" uuid NOT NULL,
	"total_quantity" integer NOT NULL,
	"used_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_package_item_balances_total_positive" CHECK ("customer_package_item_balances"."total_quantity" > 0),
	CONSTRAINT "customer_package_item_balances_used_non_negative" CHECK ("customer_package_item_balances"."used_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "service_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"item_type" "sale_item_type" NOT NULL,
	"service_id" uuid,
	"product_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_package_items_quantity_positive" CHECK ("service_package_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "customer_service_packages" ADD COLUMN "purchase_sale_id" uuid;--> statement-breakpoint
ALTER TABLE "service_package_usages" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "service_package_usages" ADD COLUMN "sale_item_id" uuid;--> statement-breakpoint
ALTER TABLE "service_package_usages" ADD COLUMN "package_item_id" uuid;--> statement-breakpoint
ALTER TABLE "service_package_usages" ADD COLUMN "quantity_used" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_packages" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_package_item_balances" ADD CONSTRAINT "customer_package_item_balances_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_package_item_balances" ADD CONSTRAINT "customer_package_item_balances_customer_package_id_customer_service_packages_id_fk" FOREIGN KEY ("customer_package_id") REFERENCES "public"."customer_service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_package_item_balances" ADD CONSTRAINT "customer_package_item_balances_package_item_id_service_package_items_id_fk" FOREIGN KEY ("package_item_id") REFERENCES "public"."service_package_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_package_item_balances_package_item_unique" ON "customer_package_item_balances" USING btree ("customer_package_id","package_item_id");--> statement-breakpoint
ALTER TABLE "customer_service_packages" ADD CONSTRAINT "customer_service_packages_purchase_sale_id_sales_id_fk" FOREIGN KEY ("purchase_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_usages" ADD CONSTRAINT "service_package_usages_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_usages" ADD CONSTRAINT "service_package_usages_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_usages" ADD CONSTRAINT "service_package_usages_package_item_id_service_package_items_id_fk" FOREIGN KEY ("package_item_id") REFERENCES "public"."service_package_items"("id") ON DELETE restrict ON UPDATE no action;