CREATE TABLE "purchase_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"purchaser_customer_id" uuid,
	"issued_sale_id" uuid,
	"original_amount_cents" integer NOT NULL,
	"balance_cents" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"message" text,
	"issued_by_user_id" uuid,
	"exhausted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_vouchers_original_positive" CHECK ("purchase_vouchers"."original_amount_cents" > 0),
	CONSTRAINT "purchase_vouchers_balance_non_negative" CHECK ("purchase_vouchers"."balance_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_voucher_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"sale_id" uuid,
	"delta_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_payments" ADD COLUMN "voucher_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_purchaser_customer_id_customers_id_fk" FOREIGN KEY ("purchaser_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_issued_sale_id_sales_id_fk" FOREIGN KEY ("issued_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_voucher_movements" ADD CONSTRAINT "purchase_voucher_movements_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_voucher_movements" ADD CONSTRAINT "purchase_voucher_movements_voucher_id_purchase_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."purchase_vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_voucher_movements" ADD CONSTRAINT "purchase_voucher_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_voucher_movements" ADD CONSTRAINT "purchase_voucher_movements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_voucher_id_purchase_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."purchase_vouchers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_vouchers_salon_code_unique" ON "purchase_vouchers" USING btree ("salon_id","code");
