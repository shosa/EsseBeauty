ALTER TABLE "customers" ADD COLUMN "phone_normalized" text;--> statement-breakpoint
WITH phone_candidates AS (
  SELECT
    id,
    trim(coalesce(phone, '')) AS input,
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') AS digits
  FROM customers
)
UPDATE customers AS customer
SET phone_normalized = CASE
  WHEN candidate.input LIKE '+%' AND length(candidate.digits) BETWEEN 8 AND 15
    THEN '+' || candidate.digits
  WHEN candidate.input LIKE '00%' AND length(substring(candidate.digits FROM 3)) BETWEEN 8 AND 15
    THEN '+' || substring(candidate.digits FROM 3)
  WHEN left(candidate.digits, 2) = '39' AND length(candidate.digits) BETWEEN 8 AND 15
    THEN '+' || candidate.digits
  WHEN length('39' || candidate.digits) BETWEEN 8 AND 15
    THEN '+39' || candidate.digits
  ELSE NULL
END
FROM phone_candidates AS candidate
WHERE customer.id = candidate.id;--> statement-breakpoint
CREATE INDEX "customers_salon_phone_normalized_idx" ON "customers" USING btree ("salon_id", "phone_normalized");--> statement-breakpoint
UPDATE communication_conversations AS conversation
SET customer_id = (
  SELECT customer.id
  FROM customers AS customer
  WHERE customer.salon_id = conversation.salon_id
    AND customer.phone_normalized = '+' || conversation.participant_phone
  ORDER BY customer.created_at, customer.id
  LIMIT 1
)
WHERE conversation.customer_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM customers AS customer
    WHERE customer.salon_id = conversation.salon_id
      AND customer.phone_normalized = '+' || conversation.participant_phone
  );
