CREATE TYPE "public"."sale_status" AS ENUM('open', 'paid', 'void');
CREATE TYPE "public"."sale_item_type" AS ENUM('service', 'product', 'custom');
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'bank_transfer', 'voucher', 'other');

CREATE TABLE "sales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "appointment_id" uuid,
  "customer_id" uuid,
  "staff_id" uuid,
  "status" "sale_status" DEFAULT 'open' NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "discount_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "closed_at" timestamp with time zone,
  "closed_by_user_id" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sales_subtotal_non_negative" CHECK ("sales"."subtotal_cents" >= 0),
  CONSTRAINT "sales_discount_non_negative" CHECK ("sales"."discount_cents" >= 0),
  CONSTRAINT "sales_total_non_negative" CHECK ("sales"."total_cents" >= 0)
);

CREATE TABLE "sale_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid NOT NULL,
  "salon_id" uuid NOT NULL,
  "item_type" "sale_item_type" NOT NULL,
  "service_id" uuid,
  "product_id" uuid,
  "staff_id" uuid,
  "description" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "discount_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
  CONSTRAINT "sale_items_unit_price_non_negative" CHECK ("sale_items"."unit_price_cents" >= 0),
  CONSTRAINT "sale_items_discount_non_negative" CHECK ("sale_items"."discount_cents" >= 0),
  CONSTRAINT "sale_items_total_non_negative" CHECK ("sale_items"."total_cents" >= 0)
);

CREATE TABLE "sale_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid NOT NULL,
  "salon_id" uuid NOT NULL,
  "method" "payment_method" NOT NULL,
  "amount_cents" integer NOT NULL,
  "reference" text,
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sale_payments_amount_positive" CHECK ("sale_payments"."amount_cents" > 0)
);

ALTER TABLE "sales" ADD CONSTRAINT "sales_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade;
ALTER TABLE "sales" ADD CONSTRAINT "sales_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null;
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null;
ALTER TABLE "sales" ADD CONSTRAINT "sales_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null;
ALTER TABLE "sales" ADD CONSTRAINT "sales_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE set null;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null;
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade;
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade;
CREATE UNIQUE INDEX "sales_appointment_unique" ON "sales" USING btree ("appointment_id");
