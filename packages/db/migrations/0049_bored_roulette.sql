ALTER TYPE "public"."reminder_channel" ADD VALUE 'app';--> statement-breakpoint
CREATE TABLE "customer_app_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminder_settings" ADD COLUMN "app_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_app_messages" ADD CONSTRAINT "customer_app_messages_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_app_messages" ADD CONSTRAINT "customer_app_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
