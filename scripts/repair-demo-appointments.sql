\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE seed_context AS
SELECT id AS salon_id, timezone
FROM salons
ORDER BY created_at
LIMIT 1;

DELETE FROM appointments
WHERE salon_id = (SELECT salon_id FROM seed_context)
  AND internal_notes LIKE '[DEMO]%';

WITH
staff_ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY display_name) AS staff_rank
  FROM staff
  WHERE salon_id = (SELECT salon_id FROM seed_context)
    AND active
),
customer_ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY full_name) AS customer_rank,
    count(*) OVER () AS customer_count
  FROM customers
  WHERE salon_id = (SELECT salon_id FROM seed_context)
    AND archived_at IS NULL
    AND blocked = false
),
working_days AS (
  SELECT
    day::date,
    extract(isodow FROM day)::int AS weekday,
    row_number() OVER (ORDER BY day) AS day_rank
  FROM generate_series(
    current_date - interval '21 days',
    current_date + interval '35 days',
    interval '1 day'
  ) AS day
  WHERE extract(isodow FROM day) IN (2, 3, 4, 5, 6)
),
day_slots AS (
  SELECT *
  FROM (VALUES
    (2, 1, time '09:00', 60), (2, 2, time '10:15', 60), (2, 3, time '11:30', 75),
    (2, 4, time '16:00', 60), (2, 5, time '17:15', 60), (2, 6, time '18:30', 75),
    (3, 1, time '09:00', 60), (3, 2, time '10:15', 60), (3, 3, time '11:30', 60),
    (3, 4, time '12:45', 60), (3, 5, time '14:00', 60), (3, 6, time '15:15', 75),
    (4, 1, time '09:00', 60), (4, 2, time '10:15', 60), (4, 3, time '11:30', 75),
    (4, 4, time '16:00', 60), (4, 5, time '17:15', 60), (4, 6, time '18:30', 75),
    (5, 1, time '09:00', 60), (5, 2, time '10:15', 60), (5, 3, time '11:30', 75),
    (5, 4, time '16:00', 60), (5, 5, time '17:15', 60), (5, 6, time '18:30', 75),
    (6, 1, time '09:00', 60), (6, 2, time '10:15', 60), (6, 3, time '11:30', 60),
    (6, 4, time '12:45', 60), (6, 5, time '14:00', 60), (6, 6, time '15:15', 75)
  ) AS slots(weekday, slot_number, slot_time, max_duration)
),
candidate_slots AS (
  SELECT
    wd.day,
    wd.day_rank,
    ds.slot_number,
    ds.slot_time,
    ds.max_duration,
    st.id AS staff_id,
    st.staff_rank,
    row_number() OVER (
      ORDER BY wd.day, ds.slot_number, st.staff_rank
    ) AS global_rank
  FROM working_days wd
  JOIN day_slots ds ON ds.weekday = wd.weekday
  CROSS JOIN staff_ranked st
  WHERE
    -- Giornate non perfettamente piene: assenze, buchi e carichi diversi.
    (wd.day_rank * 3 + st.staff_rank * 5 + ds.slot_number * 7) % 11 NOT IN (0, 1)
    -- Ogni tanto una collaboratrice inizia dopo o finisce prima.
    AND NOT (ds.slot_number = 1 AND (wd.day_rank + st.staff_rank) % 8 = 0)
    AND NOT (ds.slot_number = 6 AND (wd.day_rank + st.staff_rank) % 7 = 0)
),
planned AS (
  SELECT
    cs.*,
    cu.id AS customer_id,
    sv.id AS service_id,
    sv.duration_minutes,
    CASE
      WHEN cs.global_rank % 13 = 0 AND sv.duration_minutes + 15 <= cs.max_duration
        THEN sv.duration_minutes + 15
      ELSE sv.duration_minutes
    END AS actual_duration
  FROM candidate_slots cs
  JOIN LATERAL (
    SELECT cr.id
    FROM customer_ranked cr
    ORDER BY md5(cr.id::text || cs.global_rank::text)
    LIMIT 1
  ) cu ON true
  JOIN LATERAL (
    SELECT s.id, s.duration_minutes
    FROM services s
    WHERE s.salon_id = (SELECT salon_id FROM seed_context)
      AND s.active
      AND s.duration_minutes <= cs.max_duration
    ORDER BY md5(s.id::text || cs.global_rank::text)
    LIMIT 1
  ) sv ON true
),
timed AS (
  SELECT
    p.*,
    (p.day + p.slot_time) AT TIME ZONE (SELECT timezone FROM seed_context) AS starts_at,
    ((p.day + p.slot_time) + make_interval(mins => p.actual_duration))
      AT TIME ZONE (SELECT timezone FROM seed_context) AS ends_at
  FROM planned p
)
INSERT INTO appointments (
  salon_id,
  customer_id,
  staff_id,
  service_id,
  starts_at,
  ends_at,
  status,
  internal_notes,
  source,
  confirmed_at,
  cancelled_at,
  cancellation_reason
)
SELECT
  (SELECT salon_id FROM seed_context),
  t.customer_id,
  t.staff_id,
  t.service_id,
  t.starts_at,
  t.ends_at,
  CASE
    WHEN t.day < current_date AND t.global_rank % 19 = 0 THEN 'no_show'::appointment_status
    WHEN t.day < current_date AND t.global_rank % 17 = 0 THEN 'cancelled'::appointment_status
    WHEN t.day < current_date THEN 'completed'::appointment_status
    WHEN t.global_rank % 12 = 0 THEN 'pending'::appointment_status
    ELSE 'confirmed'::appointment_status
  END,
  CASE
    WHEN t.actual_duration > t.duration_minutes
      THEN '[DEMO REALISTICO] Durata personalizzata per esigenze della cliente.'
    ELSE '[DEMO REALISTICO] Appuntamento dimostrativo.'
  END,
  CASE
    WHEN t.global_rank % 4 = 0 THEN 'online'::appointment_source
    WHEN t.global_rank % 9 = 0 THEN 'walk_in'::appointment_source
    ELSE 'manual'::appointment_source
  END,
  CASE
    WHEN t.day >= current_date OR t.global_rank % 17 <> 0 THEN now()
    ELSE NULL
  END,
  CASE
    WHEN t.day < current_date AND t.global_rank % 17 = 0
      THEN t.starts_at - interval '1 day'
    ELSE NULL
  END,
  CASE
    WHEN t.day < current_date AND t.global_rank % 17 = 0
      THEN 'Imprevisto personale'
    ELSE NULL
  END
FROM timed t
WHERE NOT EXISTS (
  SELECT 1
  FROM appointments existing
  WHERE existing.salon_id = (SELECT salon_id FROM seed_context)
    AND existing.staff_id = t.staff_id
    AND existing.status <> 'cancelled'
    AND existing.starts_at < t.ends_at
    AND existing.ends_at > t.starts_at
);

COMMIT;

SELECT
  count(*) AS appuntamenti_demo,
  count(DISTINCT date(starts_at AT TIME ZONE 'Europe/Rome')) AS giornate,
  round(count(*)::numeric / count(DISTINCT date(starts_at AT TIME ZONE 'Europe/Rome')), 1) AS media_giornaliera
FROM appointments
WHERE internal_notes LIKE '[DEMO REALISTICO]%';
