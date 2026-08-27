\set ON_ERROR_STOP on

-- Minimal operational dataset.
-- Owner: admin@essebeauty.local / stefanosolidoro
-- Staff: anna@essebeauty.local, giulia@essebeauty.local / stefanosolidoro

BEGIN;

DO $$
DECLARE
  seed_salon_id constant uuid := '10000000-0000-4000-8000-000000000001';
BEGIN
  IF EXISTS (SELECT 1 FROM salons WHERE id <> seed_salon_id) THEN
    RAISE EXCEPTION 'Seed annullato: il database contiene gia un altro salone';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salons
    WHERE id = seed_salon_id AND slug <> 'essebeauty-demo'
  ) THEN
    RAISE EXCEPTION 'Seed annullato: l''identificativo del salone demo e gia occupato';
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff
    WHERE salon_id = seed_salon_id
      AND id NOT IN (
        '30000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000002'
      )
  ) OR EXISTS (
    SELECT 1 FROM services
    WHERE salon_id = seed_salon_id
      AND id NOT IN (
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002',
        '50000000-0000-4000-8000-000000000003',
        '50000000-0000-4000-8000-000000000004',
        '50000000-0000-4000-8000-000000000005',
        '50000000-0000-4000-8000-000000000006',
        '50000000-0000-4000-8000-000000000007',
        '50000000-0000-4000-8000-000000000008',
        '50000000-0000-4000-8000-000000000009',
        '50000000-0000-4000-8000-000000000010'
      )
  ) OR EXISTS (
    SELECT 1 FROM inventory_products
    WHERE salon_id = seed_salon_id
      AND id NOT IN (
        '60000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000002',
        '60000000-0000-4000-8000-000000000003',
        '60000000-0000-4000-8000-000000000004',
        '60000000-0000-4000-8000-000000000005'
      )
  ) THEN
    RAISE EXCEPTION 'Seed annullato: il salone demo contiene dati non gestiti dal seed';
  END IF;
END $$;

INSERT INTO salons (
  id, name, slug, timezone, locale, address, city, postal_code, province,
  country, phone, email, brand_color, plan_id, active, onboarding_step,
  onboarding_completed_at
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'EsseBeauty Demo',
  'essebeauty-demo',
  'Europe/Rome',
  'it-IT',
  'Via Roma 10',
  'Milano',
  '20121',
  'MI',
  'Italia',
  '+390212345678',
  'info@essebeauty.local',
  '#792f59',
  'professional',
  true,
  5,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  locale = EXCLUDED.locale,
  active = true,
  updated_at = now();

INSERT INTO users (id, salon_id, email, full_name, role, active)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin@essebeauty.local', 'Titolare EsseBeauty', 'owner', true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'anna@essebeauty.local', 'Anna Bianchi', 'employee', true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'giulia@essebeauty.local', 'Giulia Rossi', 'employee', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  active = true;

INSERT INTO user_credentials (
  user_id, password_hash, password_salt, must_change_password
)
VALUES
  ('20000000-0000-4000-8000-000000000001', '6bbb47209516e3260cf340b434c7129d88e0c2d48ae350a700975843cff1786e108314916c8793b217f40c3bb06314a9343d110507c6e628817b5e34bf82a373', 'essebeauty-owner-seed-2026', false),
  ('20000000-0000-4000-8000-000000000002', '8b9ee977edc96cdfeab9991013473b23b3bda732fd0082f2149aeaa3d522df4f287acec3d2f81dddd29f371bc9a9bcb5b256921885f5e86c9631e1b22157fc80', 'essebeauty-anna-seed-2026', false),
  ('20000000-0000-4000-8000-000000000003', '23ae19c73d0a2df394a9058835579f40ea16841b2bb30c30800e6d879498047f4d5f35b5d9461a9f5ca7d4e3fc5bc28dedf1ef6e893a8a1f41c4186a1b0add72', 'essebeauty-giulia-seed-2026', false)
ON CONFLICT (user_id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  password_salt = EXCLUDED.password_salt,
  must_change_password = false,
  updated_at = now();

INSERT INTO staff (
  id, salon_id, user_id, display_name, bio, specializations, working_hours,
  color, job_title, phone, email, active
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'Anna Bianchi',
    'Hair stylist e color specialist.',
    ARRAY['Taglio', 'Colore', 'Styling'],
    '{"mon":[{"from":"09:00","to":"18:00"}],"tue":[{"from":"09:00","to":"18:00"}],"wed":[{"from":"09:00","to":"18:00"}],"thu":[{"from":"09:00","to":"18:00"}],"fri":[{"from":"09:00","to":"18:00"}],"sat":[],"sun":[]}'::jsonb,
    '#9b3f72',
    'Hair stylist',
    '+393331111111',
    'anna@essebeauty.local',
    true
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'Giulia Rossi',
    'Estetista specializzata in viso, mani e benessere.',
    ARRAY['Viso', 'Mani', 'Massaggi'],
    '{"mon":[{"from":"10:00","to":"19:00"}],"tue":[{"from":"10:00","to":"19:00"}],"wed":[{"from":"10:00","to":"19:00"}],"thu":[{"from":"10:00","to":"19:00"}],"fri":[{"from":"10:00","to":"19:00"}],"sat":[],"sun":[]}'::jsonb,
    '#27805d',
    'Estetista',
    '+393332222222',
    'giulia@essebeauty.local',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  specializations = EXCLUDED.specializations,
  working_hours = EXCLUDED.working_hours,
  color = EXCLUDED.color,
  job_title = EXCLUDED.job_title,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  active = true,
  updated_at = now();

INSERT INTO service_categories (id, salon_id, name, icon, active, display_order)
VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Capelli', 'scissors', true, 10),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Colore', 'palette', true, 20),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Estetica', 'sparkles', true, 30),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Benessere', 'flower-2', true, 40)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  active = true,
  display_order = EXCLUDED.display_order;

INSERT INTO services (
  id, salon_id, name, category, category_id, description, duration_minutes,
  price_cents, online_booking_enabled, color, tax_rate_basis_points, active,
  display_order
)
VALUES
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Piega', 'Capelli', '40000000-0000-4000-8000-000000000001', 'Piega professionale personalizzata.', 45, 2500, true, '#d98ba5', 2200, true, 10),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Taglio donna', 'Capelli', '40000000-0000-4000-8000-000000000001', 'Consulenza, shampoo e taglio.', 60, 4000, true, '#c96791', 2200, true, 20),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Taglio uomo', 'Capelli', '40000000-0000-4000-8000-000000000001', 'Taglio e rifinitura uomo.', 30, 2500, true, '#a84f79', 2200, true, 30),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Colore ricrescita', 'Colore', '40000000-0000-4000-8000-000000000002', 'Copertura ricrescita e trattamento finale.', 90, 5000, true, '#8d5ca6', 2200, true, 40),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Balayage', 'Colore', '40000000-0000-4000-8000-000000000002', 'Schiariture personalizzate a mano libera.', 180, 12000, true, '#72508f', 2200, true, 50),
  ('50000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'Manicure', 'Estetica', '40000000-0000-4000-8000-000000000003', 'Manicure completa con smalto.', 45, 2500, true, '#dd7ea6', 2200, true, 60),
  ('50000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'Semipermanente mani', 'Estetica', '40000000-0000-4000-8000-000000000003', 'Preparazione e applicazione semipermanente.', 60, 3500, true, '#c96494', 2200, true, 70),
  ('50000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'Pulizia viso', 'Estetica', '40000000-0000-4000-8000-000000000003', 'Detersione profonda e maschera specifica.', 75, 6000, true, '#55a19b', 2200, true, 80),
  ('50000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 'Massaggio rilassante', 'Benessere', '40000000-0000-4000-8000-000000000004', 'Massaggio corpo rilassante.', 60, 5500, true, '#c98b59', 2200, true, 90),
  ('50000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'Ceretta gambe', 'Estetica', '40000000-0000-4000-8000-000000000003', 'Epilazione completa delle gambe.', 45, 3200, true, '#e1a05c', 2200, true, 100)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  category_id = EXCLUDED.category_id,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  price_cents = EXCLUDED.price_cents,
  online_booking_enabled = EXCLUDED.online_booking_enabled,
  color = EXCLUDED.color,
  tax_rate_basis_points = EXCLUDED.tax_rate_basis_points,
  active = true,
  display_order = EXCLUDED.display_order,
  updated_at = now();

INSERT INTO service_staff (salon_id, service_id, staff_id)
SELECT
  '10000000-0000-4000-8000-000000000001',
  service_id,
  staff_id
FROM unnest(ARRAY[
  '50000000-0000-4000-8000-000000000001'::uuid,
  '50000000-0000-4000-8000-000000000002'::uuid,
  '50000000-0000-4000-8000-000000000003'::uuid,
  '50000000-0000-4000-8000-000000000004'::uuid,
  '50000000-0000-4000-8000-000000000005'::uuid,
  '50000000-0000-4000-8000-000000000006'::uuid,
  '50000000-0000-4000-8000-000000000007'::uuid,
  '50000000-0000-4000-8000-000000000008'::uuid,
  '50000000-0000-4000-8000-000000000009'::uuid,
  '50000000-0000-4000-8000-000000000010'::uuid
]) AS service_id
CROSS JOIN unnest(ARRAY[
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid
]) AS staff_id
ON CONFLICT (service_id, staff_id) DO NOTHING;

INSERT INTO inventory_products (
  id, salon_id, name, category, sku, barcode, stock_quantity,
  low_stock_threshold, unit_price_cents, cost_cents, reorder_quantity,
  supplier, preferred_supplier, item_type, unit, unit_scale, track_stock,
  sellable, internally_consumable, average_cost_cents, last_cost_cents,
  allow_negative_stock, active
)
VALUES
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Shampoo nutriente 250 ml', 'Hair care', 'PROD-001', '8050000000011', 12, 3, 1800, 850, 6, 'Beauty Professional', 'Beauty Professional', 'resale', 'pz', 1, true, true, false, 850, 850, false, true),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Maschera ristrutturante 200 ml', 'Hair care', 'PROD-002', '8050000000028', 8, 2, 2600, 1250, 4, 'Beauty Professional', 'Beauty Professional', 'resale', 'pz', 1, true, true, false, 1250, 1250, false, true),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Olio lucidante 100 ml', 'Styling', 'PROD-003', '8050000000035', 6, 2, 2400, 1100, 4, 'Style Italia', 'Style Italia', 'resale', 'pz', 1, true, true, false, 1100, 1100, false, true),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Guanti nitrile', 'Materiale di consumo', 'CONS-001', NULL, 100, 20, 0, 12, 100, 'Salon Supply', 'Salon Supply', 'consumable', 'pz', 1, true, false, true, 12, 12, false, true),
  ('60000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Colore professionale 100 ml', 'Materiale di consumo', 'CONS-002', NULL, 24, 6, 0, 650, 12, 'Color Lab', 'Color Lab', 'consumable', 'pz', 1, true, false, true, 650, 650, false, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sku = EXCLUDED.sku,
  barcode = EXCLUDED.barcode,
  stock_quantity = EXCLUDED.stock_quantity,
  low_stock_threshold = EXCLUDED.low_stock_threshold,
  unit_price_cents = EXCLUDED.unit_price_cents,
  cost_cents = EXCLUDED.cost_cents,
  reorder_quantity = EXCLUDED.reorder_quantity,
  supplier = EXCLUDED.supplier,
  preferred_supplier = EXCLUDED.preferred_supplier,
  item_type = EXCLUDED.item_type,
  unit = EXCLUDED.unit,
  unit_scale = EXCLUDED.unit_scale,
  track_stock = EXCLUDED.track_stock,
  sellable = EXCLUDED.sellable,
  internally_consumable = EXCLUDED.internally_consumable,
  average_cost_cents = EXCLUDED.average_cost_cents,
  last_cost_cents = EXCLUDED.last_cost_cents,
  allow_negative_stock = EXCLUDED.allow_negative_stock,
  active = true,
  updated_at = now();

INSERT INTO salon_modules (salon_id, module_key, enabled)
SELECT
  '10000000-0000-4000-8000-000000000001',
  module_key,
  true
FROM unnest(ARRAY[
  'reminders',
  'reviews',
  'waitlist',
  'loyalty',
  'marketing',
  'inventory',
  'staff_performance',
  'documents',
  'packages',
  'multi_location',
  'audit_compliance'
]) AS module_key
ON CONFLICT (salon_id, module_key) DO UPDATE SET
  enabled = true,
  updated_at = now();

DO $$
DECLARE
  actual_counts integer[];
BEGIN
  SELECT ARRAY[
    (SELECT count(*)::integer FROM salons),
    (SELECT count(*)::integer FROM staff),
    (SELECT count(*)::integer FROM services),
    (SELECT count(*)::integer FROM inventory_products)
  ] INTO actual_counts;

  IF actual_counts <> ARRAY[1, 2, 10, 5] THEN
    RAISE EXCEPTION 'Conteggi seed non validi: %', actual_counts;
  END IF;
END $$;

COMMIT;

SELECT
  (SELECT count(*) FROM salons) AS salons,
  (SELECT count(*) FROM staff) AS staff,
  (SELECT count(*) FROM services) AS services,
  (SELECT count(*) FROM inventory_products) AS products;
