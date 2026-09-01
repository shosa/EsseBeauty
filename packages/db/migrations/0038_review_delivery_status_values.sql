ALTER TYPE "review_delivery_status"
ADD VALUE IF NOT EXISTS 'scheduled';

--> statement-breakpoint

ALTER TYPE "review_delivery_status"
ADD VALUE IF NOT EXISTS 'delivered';