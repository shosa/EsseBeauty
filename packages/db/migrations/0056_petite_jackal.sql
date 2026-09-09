CREATE TABLE "salon_special_opening_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"special_opening_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"start_time" text,
	"end_time" text
);
--> statement-breakpoint
CREATE TABLE "salon_special_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salon_special_opening_staff" ADD CONSTRAINT "salon_special_opening_staff_special_opening_id_salon_special_openings_id_fk" FOREIGN KEY ("special_opening_id") REFERENCES "public"."salon_special_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_special_opening_staff" ADD CONSTRAINT "salon_special_opening_staff_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_special_openings" ADD CONSTRAINT "salon_special_openings_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "salon_special_opening_staff_unique" ON "salon_special_opening_staff" USING btree ("special_opening_id","staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salon_special_openings_salon_date_unique" ON "salon_special_openings" USING btree ("salon_id","date");