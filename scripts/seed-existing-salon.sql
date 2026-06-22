\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE seed_context AS
SELECT id AS salon_id
FROM salons
ORDER BY created_at
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seed_context) THEN
    RAISE EXCEPTION 'Nessun salone esistente trovato';
  END IF;
END $$;

INSERT INTO service_categories (
  salon_id, name, icon, active, display_order
)
SELECT c.salon_id, v.name, v.icon, true, v.display_order
FROM seed_context c
CROSS JOIN (VALUES
  ('Capelli', 'scissors', 10),
  ('Colore', 'brush', 20),
  ('Trattamenti capelli', 'droplets', 30),
  ('Mani e piedi', 'hand', 40),
  ('Viso', 'sparkles', 50),
  ('Massaggi', 'flower-2', 60),
  ('Depilazione', 'zap', 70)
) AS v(name, icon, display_order)
ON CONFLICT (salon_id, name) DO UPDATE SET
  icon = EXCLUDED.icon,
  active = true,
  display_order = EXCLUDED.display_order;

INSERT INTO services (
  salon_id, name, category, category_id, description, duration_minutes, price_cents,
  online_booking_enabled, color, display_order
)
SELECT c.salon_id, v.name, v.category, category.id, v.description, v.duration_minutes, v.price_cents,
       true, v.color, v.display_order
FROM seed_context c
CROSS JOIN (VALUES
  ('Piega corta', 'Capelli', 'Piega professionale per capelli corti.', 30, 1800, '#D98BA5', 10),
  ('Piega media', 'Capelli', 'Piega professionale per capelli di media lunghezza.', 45, 2300, '#D98BA5', 11),
  ('Piega lunga', 'Capelli', 'Piega professionale per capelli lunghi.', 60, 2800, '#D98BA5', 12),
  ('Taglio donna', 'Capelli', 'Consulenza, shampoo e taglio personalizzato.', 60, 3500, '#B85C83', 13),
  ('Taglio uomo', 'Capelli', 'Taglio e rifinitura uomo.', 30, 2200, '#B85C83', 14),
  ('Colore ricrescita', 'Colore', 'Copertura ricrescita con asciugatura.', 90, 4800, '#9B6AA6', 20),
  ('Colore completo', 'Colore', 'Colorazione completa e trattamento finale.', 120, 6500, '#87559A', 21),
  ('Balayage', 'Colore', 'Schiariture personalizzate a mano libera.', 180, 12000, '#75508D', 22),
  ('Tonalizzante', 'Colore', 'Riflessante e tonalizzazione post trattamento.', 45, 3000, '#A77DB6', 23),
  ('Trattamento ristrutturante', 'Trattamenti capelli', 'Trattamento intensivo per capelli danneggiati.', 45, 3500, '#57A6A1', 30),
  ('Laminazione capelli', 'Trattamenti capelli', 'Trattamento lucidante e disciplinante.', 75, 5500, '#4D918E', 31),
  ('Manicure classica', 'Mani e piedi', 'Manicure, limatura e smalto tradizionale.', 45, 2200, '#E397B0', 40),
  ('Semipermanente mani', 'Mani e piedi', 'Preparazione unghia e applicazione semipermanente.', 60, 3200, '#D77CA0', 41),
  ('Pedicure estetico', 'Mani e piedi', 'Pedicure estetico completo.', 60, 3500, '#C96B92', 42),
  ('Pulizia viso', 'Viso', 'Detersione profonda e maschera specifica.', 75, 5500, '#70A8A0', 50),
  ('Trattamento viso idratante', 'Viso', 'Trattamento idratante personalizzato.', 60, 6000, '#5D9891', 51),
  ('Massaggio decontratturante', 'Massaggi', 'Massaggio mirato alle tensioni muscolari.', 60, 5500, '#C58B5B', 60),
  ('Massaggio drenante', 'Massaggi', 'Trattamento manuale drenante corpo.', 50, 5000, '#B77A4D', 61),
  ('Ceretta gambe completa', 'Depilazione', 'Epilazione completa delle gambe.', 45, 3000, '#E2A35E', 70),
  ('Ceretta inguine', 'Depilazione', 'Epilazione inguine personalizzata.', 20, 1500, '#E2A35E', 71)
) AS v(name, category, description, duration_minutes, price_cents, color, display_order)
CROSS JOIN LATERAL (
  SELECT id
  FROM service_categories category
  WHERE category.salon_id = c.salon_id
    AND category.name = v.category
) category
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.salon_id = c.salon_id AND lower(s.name) = lower(v.name)
);

UPDATE services service
SET category_id = category.id
FROM service_categories category
WHERE service.salon_id = (SELECT salon_id FROM seed_context)
  AND category.salon_id = service.salon_id
  AND lower(category.name) = lower(service.category)
  AND service.category_id IS DISTINCT FROM category.id;

INSERT INTO service_staff (salon_id, service_id, staff_id)
SELECT s.salon_id, s.id, st.id
FROM services s
JOIN staff st ON st.salon_id = s.salon_id AND st.active
JOIN seed_context c ON c.salon_id = s.salon_id
ON CONFLICT DO NOTHING;

INSERT INTO inventory_products (
  salon_id, name, category, sku, barcode, stock_quantity, low_stock_threshold,
  unit_price_cents, cost_cents, reorder_quantity, supplier, preferred_supplier,
  allow_negative_stock, active
)
SELECT c.salon_id, v.name, v.category, v.sku, v.barcode, v.stock_quantity,
       v.low_stock_threshold, v.unit_price_cents, v.cost_cents, v.reorder_quantity,
       v.supplier, v.supplier, true, true
FROM seed_context c
CROSS JOIN (VALUES
  ('Shampoo nutriente 250ml', 'Hair care', 'HC-001', '8050000000011', 18, 5, 1800, 850, 12, 'Beauty Professional'),
  ('Shampoo antigiallo 250ml', 'Hair care', 'HC-002', '8050000000028', 9, 4, 2100, 1050, 8, 'Beauty Professional'),
  ('Shampoo cute sensibile 250ml', 'Hair care', 'HC-003', '8050000000035', 12, 4, 1900, 900, 8, 'TricoLab'),
  ('Balsamo idratante 250ml', 'Hair care', 'HC-004', '8050000000042', 15, 5, 2000, 950, 10, 'Beauty Professional'),
  ('Maschera ristrutturante 200ml', 'Hair care', 'HC-005', '8050000000059', 11, 4, 2600, 1250, 8, 'TricoLab'),
  ('Olio lucidante 100ml', 'Styling', 'ST-001', '8050000000066', 8, 3, 2400, 1100, 6, 'Style Italia'),
  ('Termoprotettore spray', 'Styling', 'ST-002', '8050000000073', 14, 4, 2200, 980, 8, 'Style Italia'),
  ('Lacca tenuta naturale', 'Styling', 'ST-003', '8050000000080', 10, 3, 1700, 780, 6, 'Style Italia'),
  ('Mousse volume', 'Styling', 'ST-004', '8050000000097', 7, 3, 1900, 850, 6, 'Style Italia'),
  ('Crema definizione ricci', 'Styling', 'ST-005', '8050000000103', 13, 4, 2300, 1020, 8, 'Curl Studio'),
  ('Siero anticrespo', 'Styling', 'ST-006', '8050000000110', 6, 3, 2500, 1200, 6, 'Curl Studio'),
  ('Detergente viso delicato', 'Viso', 'VI-001', '8050000000127', 12, 4, 2400, 1150, 8, 'Dermalab'),
  ('Crema viso idratante', 'Viso', 'VI-002', '8050000000134', 10, 4, 3200, 1550, 8, 'Dermalab'),
  ('Siero vitamina C', 'Viso', 'VI-003', '8050000000141', 7, 3, 3900, 1900, 6, 'Dermalab'),
  ('Maschera viso lenitiva', 'Viso', 'VI-004', '8050000000158', 9, 3, 1800, 800, 6, 'Dermalab'),
  ('Scrub corpo', 'Corpo', 'CO-001', '8050000000165', 8, 3, 2700, 1250, 6, 'Body Ritual'),
  ('Crema corpo nutriente', 'Corpo', 'CO-002', '8050000000172', 11, 4, 2900, 1380, 8, 'Body Ritual'),
  ('Olio massaggio drenante', 'Corpo', 'CO-003', '8050000000189', 5, 3, 3400, 1600, 6, 'Body Ritual'),
  ('Base semipermanente', 'Nails', 'NA-001', '8050000000196', 16, 5, 1500, 650, 10, 'Nail Pro'),
  ('Top coat semipermanente', 'Nails', 'NA-002', '8050000000202', 14, 5, 1500, 650, 10, 'Nail Pro'),
  ('Olio cuticole', 'Nails', 'NA-003', '8050000000219', 20, 6, 1200, 500, 12, 'Nail Pro'),
  ('Smalto nude', 'Nails', 'NA-004', '8050000000226', 8, 3, 1000, 420, 6, 'Nail Pro'),
  ('Smalto rosso classico', 'Nails', 'NA-005', '8050000000233', 9, 3, 1000, 420, 6, 'Nail Pro'),
  ('Latte dopocera', 'Depilazione', 'DE-001', '8050000000240', 13, 4, 1600, 720, 8, 'Epil Beauty'),
  ('Scrub pre-epilazione', 'Depilazione', 'DE-002', '8050000000257', 7, 3, 1900, 850, 6, 'Epil Beauty'),
  ('Spazzola districante', 'Accessori', 'AC-001', '8050000000264', 18, 5, 1400, 600, 10, 'Salon Tools'),
  ('Pettine professionale', 'Accessori', 'AC-002', '8050000000271', 22, 6, 900, 350, 12, 'Salon Tools'),
  ('Cuffia in raso', 'Accessori', 'AC-003', '8050000000288', 10, 3, 1800, 750, 6, 'Curl Studio')
) AS v(name, category, sku, barcode, stock_quantity, low_stock_threshold, unit_price_cents, cost_cents, reorder_quantity, supplier)
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_products p
  WHERE p.salon_id = c.salon_id AND lower(p.name) = lower(v.name)
);

INSERT INTO inventory_movements (salon_id, product_id, delta, reason, stock_after, note)
SELECT p.salon_id, p.id, p.stock_quantity, 'Carico iniziale demo', p.stock_quantity,
       'Dataset dimostrativo per il salone'
FROM inventory_products p
JOIN seed_context c ON c.salon_id = p.salon_id
WHERE p.sku LIKE 'HC-%' OR p.sku LIKE 'ST-%' OR p.sku LIKE 'VI-%'
   OR p.sku LIKE 'CO-%' OR p.sku LIKE 'NA-%' OR p.sku LIKE 'DE-%' OR p.sku LIKE 'AC-%'
AND NOT EXISTS (
  SELECT 1 FROM inventory_movements m
  WHERE m.product_id = p.id AND m.reason = 'Carico iniziale demo'
);

INSERT INTO customers (
  salon_id, full_name, email, phone, notes, tags,
  marketing_email_consent, marketing_sms_consent
)
SELECT c.salon_id, v.full_name, v.email, v.phone, v.notes, v.tags, v.email_ok, v.sms_ok
FROM seed_context c
CROSS JOIN (VALUES
  ('Alessandra Romano', 'alessandra.romano@example.com', '3201001001', 'Preferisce appuntamenti mattutini.', ARRAY['abituale','capelli'], true, true),
  ('Giulia Esposito', 'giulia.esposito@example.com', '3201001002', NULL, ARRAY['nuova'], true, false),
  ('Valentina Russo', 'valentina.russo@example.com', '3201001003', 'Cute sensibile.', ARRAY['capelli','sensibile'], true, true),
  ('Federica Conti', 'federica.conti@example.com', '3201001004', NULL, ARRAY['abituale','nails'], true, true),
  ('Elena Marino', 'elena.marino@example.com', '3201001005', 'Gradisce prodotti senza profumo.', ARRAY['viso'], false, true),
  ('Sara Greco', 'sara.greco@example.com', '3201001006', NULL, ARRAY['nuova','capelli'], true, true),
  ('Martina Costa', 'martina.costa@example.com', '3201001007', NULL, ARRAY['abituale'], true, false),
  ('Laura Gallo', 'laura.gallo@example.com', '3201001008', 'Allergia al nichel segnalata.', ARRAY['sensibile'], false, false),
  ('Chiara De Luca', 'chiara.deluca@example.com', '3201001009', NULL, ARRAY['capelli','colore'], true, true),
  ('Silvia Ferrara', 'silvia.ferrara@example.com', '3201001010', NULL, ARRAY['massaggi'], true, true),
  ('Francesca Rizzo', 'francesca.rizzo@example.com', '3201001011', NULL, ARRAY['nails'], true, false),
  ('Anna Lombardi', 'anna.lombardi@example.com', '3201001012', 'Preferisce Claudia.', ARRAY['abituale','viso'], true, true),
  ('Ilaria Moretti', 'ilaria.moretti@example.com', '3201001013', NULL, ARRAY['capelli'], true, true),
  ('Roberta Barbieri', 'roberta.barbieri@example.com', '3201001014', NULL, ARRAY['depilazione'], false, true),
  ('Marta Fontana', 'marta.fontana@example.com', '3201001015', 'Telefonare prima di spostare appuntamenti.', ARRAY['abituale'], true, true),
  ('Beatrice Santoro', 'beatrice.santoro@example.com', '3201001016', NULL, ARRAY['nuova'], true, false),
  ('Camilla Mariani', 'camilla.mariani@example.com', '3201001017', NULL, ARRAY['colore'], true, true),
  ('Alice Rinaldi', 'alice.rinaldi@example.com', '3201001018', NULL, ARRAY['nails','viso'], true, true),
  ('Serena Caruso', 'serena.caruso@example.com', '3201001019', 'Cliente fidelizzata.', ARRAY['vip','abituale'], true, true),
  ('Noemi Ferri', 'noemi.ferri@example.com', '3201001020', NULL, ARRAY['massaggi'], true, false),
  ('Giorgia Bianco', 'giorgia.bianco@example.com', '3201001021', NULL, ARRAY['capelli'], true, true),
  ('Aurora Martini', 'aurora.martini@example.com', '3201001022', NULL, ARRAY['nuova','viso'], true, true),
  ('Daniela Serra', 'daniela.serra@example.com', '3201001023', 'No SMS promozionali.', ARRAY['abituale'], true, false),
  ('Cristina Fabbri', 'cristina.fabbri@example.com', '3201001024', NULL, ARRAY['depilazione'], true, true),
  ('Monica Villa', 'monica.villa@example.com', '3201001025', NULL, ARRAY['capelli','colore'], true, true),
  ('Paola Leone', 'paola.leone@example.com', '3201001026', NULL, ARRAY['viso'], false, true),
  ('Simona Sala', 'simona.sala@example.com', '3201001027', NULL, ARRAY['nails'], true, true),
  ('Elisa Grassi', 'elisa.grassi@example.com', '3201001028', NULL, ARRAY['massaggi'], true, false),
  ('Veronica Monti', 'veronica.monti@example.com', '3201001029', NULL, ARRAY['capelli'], true, true),
  ('Nicole Piras', 'nicole.piras@example.com', '3201001030', 'Prima visita.', ARRAY['nuova'], true, true),
  ('Maria Testa', 'maria.testa@example.com', '3201001031', NULL, ARRAY['abituale','capelli'], true, true),
  ('Rita Marchetti', 'rita.marchetti@example.com', '3201001032', NULL, ARRAY['viso'], true, false),
  ('Patrizia Fiore', 'patrizia.fiore@example.com', '3201001033', NULL, ARRAY['depilazione'], true, true),
  ('Sofia Messina', 'sofia.messina@example.com', '3201001034', NULL, ARRAY['nails'], true, true),
  ('Gaia Palmieri', 'gaia.palmieri@example.com', '3201001035', NULL, ARRAY['colore'], true, false),
  ('Emma Guerra', 'emma.guerra@example.com', '3201001036', NULL, ARRAY['capelli'], true, true),
  ('Lucia Vitale', 'lucia.vitale@example.com', '3201001037', NULL, ARRAY['massaggi'], false, true),
  ('Barbara Amato', 'barbara.amato@example.com', '3201001038', NULL, ARRAY['abituale'], true, true),
  ('Debora Neri', 'debora.neri@example.com', '3201001039', NULL, ARRAY['viso','nails'], true, true),
  ('Caterina Parisi', 'caterina.parisi@example.com', '3201001040', NULL, ARRAY['capelli'], true, false),
  ('Lidia Coppola', 'lidia.coppola@example.com', '3201001041', NULL, ARRAY['depilazione'], true, true),
  ('Teresa D Amico', 'teresa.damico@example.com', '3201001042', NULL, ARRAY['abituale'], true, true),
  ('Arianna Longo', 'arianna.longo@example.com', '3201001043', NULL, ARRAY['nuova','capelli'], true, true),
  ('Rachele Orlando', 'rachele.orlando@example.com', '3201001044', NULL, ARRAY['colore'], true, false),
  ('Claudia Pellegrini', 'claudia.pellegrini@example.com', '3201001045', NULL, ARRAY['vip','viso'], true, true)
) AS v(full_name, email, phone, notes, tags, email_ok, sms_ok)
WHERE NOT EXISTS (
  SELECT 1 FROM customers cu
  WHERE cu.salon_id = c.salon_id AND lower(cu.email) = lower(v.email)
);

WITH
staff_ranked AS (
  SELECT id, salon_id, row_number() OVER (ORDER BY display_name) AS rn,
         count(*) OVER () AS total
  FROM staff
  WHERE salon_id = (SELECT salon_id FROM seed_context) AND active
),
customer_ranked AS (
  SELECT id, row_number() OVER (ORDER BY full_name) AS rn,
         count(*) OVER () AS total
  FROM customers
  WHERE salon_id = (SELECT salon_id FROM seed_context) AND archived_at IS NULL
),
service_ranked AS (
  SELECT id, duration_minutes, row_number() OVER (ORDER BY display_order, name) AS rn,
         count(*) OVER () AS total
  FROM services
  WHERE salon_id = (SELECT salon_id FROM seed_context) AND active
),
slots AS (
  SELECT
    d::date AS day,
    t.slot_time,
    row_number() OVER (ORDER BY d, t.slot_time) AS rn
  FROM generate_series(current_date - interval '24 days', current_date + interval '35 days', interval '1 day') d
  CROSS JOIN (VALUES
    (time '09:00'), (time '10:30'), (time '12:00'),
    (time '15:00'), (time '16:30'), (time '18:00')
  ) AS t(slot_time)
  WHERE extract(isodow FROM d) BETWEEN 1 AND 6
),
planned AS (
  SELECT
    s.day,
    s.slot_time,
    sr.id AS staff_id,
    cr.id AS customer_id,
    svr.id AS service_id,
    svr.duration_minutes,
    s.rn
  FROM slots s
  JOIN staff_ranked sr ON sr.rn = ((s.rn - 1) % sr.total) + 1
  JOIN customer_ranked cr ON cr.rn = ((s.rn * 7 - 1) % cr.total) + 1
  JOIN service_ranked svr ON svr.rn = ((s.rn * 5 - 1) % svr.total) + 1
  ORDER BY s.day, s.slot_time
  LIMIT 190
)
INSERT INTO appointments (
  salon_id, customer_id, staff_id, service_id, starts_at, ends_at,
  status, internal_notes, source, confirmed_at, cancelled_at, cancellation_reason
)
SELECT
  (SELECT salon_id FROM seed_context),
  p.customer_id,
  p.staff_id,
  p.service_id,
  (p.day + p.slot_time) AT TIME ZONE 'Europe/Rome',
  ((p.day + p.slot_time) + make_interval(mins => p.duration_minutes)) AT TIME ZONE 'Europe/Rome',
  CASE
    WHEN p.day < current_date AND p.rn % 13 = 0 THEN 'no_show'::appointment_status
    WHEN p.day < current_date AND p.rn % 11 = 0 THEN 'cancelled'::appointment_status
    WHEN p.day < current_date THEN 'completed'::appointment_status
    WHEN p.rn % 9 = 0 THEN 'pending'::appointment_status
    ELSE 'confirmed'::appointment_status
  END,
  CASE
    WHEN p.rn % 10 = 0 THEN '[DEMO] Cliente con durata personalizzata o richiesta specifica.'
    ELSE '[DEMO] Appuntamento dimostrativo.'
  END,
  CASE WHEN p.rn % 4 = 0 THEN 'online'::appointment_source ELSE 'manual'::appointment_source END,
  CASE WHEN p.day >= current_date OR (p.day < current_date AND p.rn % 11 <> 0) THEN now() ELSE NULL END,
  CASE WHEN p.day < current_date AND p.rn % 11 = 0 THEN (p.day + p.slot_time - interval '1 day') AT TIME ZONE 'Europe/Rome' ELSE NULL END,
  CASE WHEN p.day < current_date AND p.rn % 11 = 0 THEN 'Imprevisto personale' ELSE NULL END
FROM planned p
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.salon_id = (SELECT salon_id FROM seed_context)
    AND a.staff_id = p.staff_id
    AND a.starts_at = (p.day + p.slot_time) AT TIME ZONE 'Europe/Rome'
);

COMMIT;

SELECT
  (SELECT name FROM salons WHERE id = (SELECT salon_id FROM seed_context)) AS salon,
  (SELECT count(*) FROM services WHERE salon_id = (SELECT salon_id FROM seed_context)) AS services,
  (SELECT count(*) FROM inventory_products WHERE salon_id = (SELECT salon_id FROM seed_context)) AS products,
  (SELECT count(*) FROM customers WHERE salon_id = (SELECT salon_id FROM seed_context)) AS customers,
  (SELECT count(*) FROM appointments WHERE salon_id = (SELECT salon_id FROM seed_context)) AS appointments;
