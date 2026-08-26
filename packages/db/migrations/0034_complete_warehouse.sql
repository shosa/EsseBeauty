ALTER TABLE inventory_products ADD COLUMN item_type text NOT NULL DEFAULT 'resale';
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN unit text NOT NULL DEFAULT 'pz';
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN unit_scale integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN track_stock boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN sellable boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN internally_consumable boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN average_cost_cents integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN last_cost_cents integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE inventory_products SET average_cost_cents = COALESCE(cost_cents, 0), last_cost_cents = COALESCE(cost_cents, 0);
--> statement-breakpoint
ALTER TABLE inventory_products ADD COLUMN preferred_supplier_id uuid;
--> statement-breakpoint
ALTER TABLE inventory_products ADD CONSTRAINT inventory_products_item_type_valid CHECK (item_type IN ('resale', 'consumable', 'equipment', 'expense'));
--> statement-breakpoint
ALTER TABLE inventory_products ADD CONSTRAINT inventory_products_unit_scale_positive CHECK (unit_scale > 0);
--> statement-breakpoint
ALTER TABLE inventory_movements ADD COLUMN document_id uuid;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD COLUMN document_line_id uuid;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD COLUMN movement_type text;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD COLUMN stock_before integer;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD COLUMN unit_cost_cents integer;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD COLUMN value_cents integer;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD COLUMN reverses_movement_id uuid;
--> statement-breakpoint

CREATE TABLE inventory_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  salon_id uuid NOT NULL,
  name text NOT NULL,
  contact_name text,
  vat_number text,
  tax_code text,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text,
  payment_terms text,
  notes text,
  active boolean DEFAULT true NOT NULL,
  archived_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE inventory_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  salon_id uuid NOT NULL,
  internal_number text NOT NULL,
  kind text NOT NULL,
  status text DEFAULT 'draft' NOT NULL,
  supplier_id uuid,
  external_reference text,
  document_date timestamp with time zone DEFAULT now() NOT NULL,
  competence_date timestamp with time zone,
  notes text,
  attachment_url text,
  net_total_cents integer DEFAULT 0 NOT NULL,
  tax_total_cents integer DEFAULT 0 NOT NULL,
  total_cents integer DEFAULT 0 NOT NULL,
  created_by_user_id uuid,
  posted_by_user_id uuid,
  posted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  reversal_of_document_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT inventory_documents_kind_valid CHECK (kind IN ('opening', 'purchase', 'supplier_invoice', 'internal_use', 'waste', 'supplier_return', 'adjustment', 'count', 'credit_note', 'equipment_purchase', 'expense')),
  CONSTRAINT inventory_documents_status_valid CHECK (status IN ('draft', 'posted', 'cancelled', 'reversed')),
  CONSTRAINT inventory_documents_net_total_non_negative CHECK (net_total_cents >= 0),
  CONSTRAINT inventory_documents_tax_total_non_negative CHECK (tax_total_cents >= 0),
  CONSTRAINT inventory_documents_total_non_negative CHECK (total_cents >= 0)
);
--> statement-breakpoint
CREATE TABLE inventory_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL,
  salon_id uuid NOT NULL,
  product_id uuid,
  supplier_id uuid,
  line_number integer NOT NULL,
  description text NOT NULL,
  item_type text DEFAULT 'resale' NOT NULL,
  quantity integer NOT NULL,
  unit text DEFAULT 'pz' NOT NULL,
  unit_scale integer DEFAULT 1 NOT NULL,
  stock_delta integer DEFAULT 0 NOT NULL,
  unit_cost_cents integer DEFAULT 0 NOT NULL,
  discount_cents integer DEFAULT 0 NOT NULL,
  tax_rate_basis_points integer DEFAULT 0 NOT NULL,
  net_cents integer DEFAULT 0 NOT NULL,
  tax_cents integer DEFAULT 0 NOT NULL,
  total_cents integer DEFAULT 0 NOT NULL,
  destination text,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT inventory_document_lines_item_type_valid CHECK (item_type IN ('resale', 'consumable', 'equipment', 'expense')),
  CONSTRAINT inventory_document_lines_unit_scale_positive CHECK (unit_scale > 0),
  CONSTRAINT inventory_document_lines_unit_cost_non_negative CHECK (unit_cost_cents >= 0),
  CONSTRAINT inventory_document_lines_discount_non_negative CHECK (discount_cents >= 0),
  CONSTRAINT inventory_document_lines_net_non_negative CHECK (net_cents >= 0),
  CONSTRAINT inventory_document_lines_tax_non_negative CHECK (tax_cents >= 0),
  CONSTRAINT inventory_document_lines_total_non_negative CHECK (total_cents >= 0)
);
--> statement-breakpoint
CREATE TABLE inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  salon_id uuid NOT NULL,
  document_id uuid,
  status text DEFAULT 'draft' NOT NULL,
  category text,
  opened_at timestamp with time zone DEFAULT now() NOT NULL,
  posted_at timestamp with time zone,
  created_by_user_id uuid,
  posted_by_user_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT inventory_counts_status_valid CHECK (status IN ('draft', 'counting', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE inventory_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  count_id uuid NOT NULL,
  salon_id uuid NOT NULL,
  product_id uuid NOT NULL,
  theoretical_quantity integer NOT NULL,
  counted_quantity integer,
  difference_quantity integer,
  difference_value_cents integer DEFAULT 0 NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE inventory_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  salon_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_line_id uuid,
  supplier_id uuid,
  category text NOT NULL,
  competence_date timestamp with time zone NOT NULL,
  description text NOT NULL,
  net_cents integer DEFAULT 0 NOT NULL,
  tax_cents integer DEFAULT 0 NOT NULL,
  total_cents integer DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT inventory_expenses_net_non_negative CHECK (net_cents >= 0),
  CONSTRAINT inventory_expenses_tax_non_negative CHECK (tax_cents >= 0),
  CONSTRAINT inventory_expenses_total_non_negative CHECK (total_cents >= 0)
);
--> statement-breakpoint
CREATE TABLE inventory_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  salon_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_line_id uuid,
  supplier_id uuid,
  description text NOT NULL,
  serial_number text,
  purchase_date timestamp with time zone NOT NULL,
  purchase_cost_cents integer DEFAULT 0 NOT NULL,
  warranty_expires_at timestamp with time zone,
  status text DEFAULT 'active' NOT NULL,
  disposed_at timestamp with time zone,
  disposal_notes text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT inventory_assets_status_valid CHECK (status IN ('active', 'disposed')),
  CONSTRAINT inventory_assets_purchase_cost_non_negative CHECK (purchase_cost_cents >= 0)
);
--> statement-breakpoint

CREATE UNIQUE INDEX inventory_suppliers_id_salon_unique ON inventory_suppliers (id, salon_id);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_suppliers_salon_name_unique ON inventory_suppliers (salon_id, name);
--> statement-breakpoint
CREATE INDEX inventory_suppliers_salon_active_idx ON inventory_suppliers (salon_id, active);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_products_id_salon_unique ON inventory_products (id, salon_id);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_documents_id_salon_unique ON inventory_documents (id, salon_id);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_documents_salon_internal_number_unique ON inventory_documents (salon_id, internal_number);
--> statement-breakpoint
CREATE INDEX inventory_documents_salon_status_date_idx ON inventory_documents (salon_id, status, document_date);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_document_lines_id_salon_unique ON inventory_document_lines (id, salon_id);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_document_lines_document_line_unique ON inventory_document_lines (document_id, line_number);
--> statement-breakpoint
CREATE INDEX inventory_document_lines_product_idx ON inventory_document_lines (product_id);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_movements_id_salon_unique ON inventory_movements (id, salon_id);
--> statement-breakpoint
CREATE INDEX inventory_movements_salon_product_date_idx ON inventory_movements (salon_id, product_id, created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_counts_id_salon_unique ON inventory_counts (id, salon_id);
--> statement-breakpoint
CREATE INDEX inventory_counts_salon_status_date_idx ON inventory_counts (salon_id, status, opened_at);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_count_lines_id_salon_unique ON inventory_count_lines (id, salon_id);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_count_lines_count_product_unique ON inventory_count_lines (count_id, product_id);
--> statement-breakpoint
CREATE INDEX inventory_count_lines_product_idx ON inventory_count_lines (product_id);
--> statement-breakpoint
CREATE INDEX inventory_expenses_salon_competence_date_idx ON inventory_expenses (salon_id, competence_date);
--> statement-breakpoint
CREATE INDEX inventory_assets_salon_purchase_date_idx ON inventory_assets (salon_id, purchase_date);
--> statement-breakpoint

ALTER TABLE inventory_suppliers ADD CONSTRAINT inventory_suppliers_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE inventory_products ADD CONSTRAINT inventory_products_preferred_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (preferred_supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_products ADD CONSTRAINT inventory_products_preferred_supplier_salon_id_fk FOREIGN KEY (preferred_supplier_id, salon_id) REFERENCES inventory_suppliers(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_documents ADD CONSTRAINT inventory_documents_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE inventory_documents ADD CONSTRAINT inventory_documents_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_documents ADD CONSTRAINT inventory_documents_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES inventory_suppliers(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_documents ADD CONSTRAINT inventory_documents_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_documents ADD CONSTRAINT inventory_documents_posted_by_user_id_users_id_fk FOREIGN KEY (posted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_documents ADD CONSTRAINT inventory_documents_reversal_of_document_id_inventory_documents_id_fk FOREIGN KEY (reversal_of_document_id) REFERENCES inventory_documents(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_documents ADD CONSTRAINT inventory_documents_reversal_salon_id_fk FOREIGN KEY (reversal_of_document_id, salon_id) REFERENCES inventory_documents(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_document_lines ADD CONSTRAINT inventory_document_lines_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE inventory_document_lines ADD CONSTRAINT inventory_document_lines_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES inventory_documents(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_document_lines ADD CONSTRAINT inventory_document_lines_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES inventory_documents(id, salon_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_document_lines ADD CONSTRAINT inventory_document_lines_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_document_lines ADD CONSTRAINT inventory_document_lines_product_salon_id_fk FOREIGN KEY (product_id, salon_id) REFERENCES inventory_products(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_document_lines ADD CONSTRAINT inventory_document_lines_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_document_lines ADD CONSTRAINT inventory_document_lines_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES inventory_suppliers(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_counts ADD CONSTRAINT inventory_counts_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE inventory_counts ADD CONSTRAINT inventory_counts_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES inventory_documents(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_counts ADD CONSTRAINT inventory_counts_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES inventory_documents(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_counts ADD CONSTRAINT inventory_counts_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_counts ADD CONSTRAINT inventory_counts_posted_by_user_id_users_id_fk FOREIGN KEY (posted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_count_lines ADD CONSTRAINT inventory_count_lines_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE inventory_count_lines ADD CONSTRAINT inventory_count_lines_count_id_inventory_counts_id_fk FOREIGN KEY (count_id) REFERENCES inventory_counts(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_count_lines ADD CONSTRAINT inventory_count_lines_count_salon_id_fk FOREIGN KEY (count_id, salon_id) REFERENCES inventory_counts(id, salon_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_count_lines ADD CONSTRAINT inventory_count_lines_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_count_lines ADD CONSTRAINT inventory_count_lines_product_salon_id_fk FOREIGN KEY (product_id, salon_id) REFERENCES inventory_products(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_expenses ADD CONSTRAINT inventory_expenses_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE inventory_expenses ADD CONSTRAINT inventory_expenses_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES inventory_documents(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_expenses ADD CONSTRAINT inventory_expenses_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES inventory_documents(id, salon_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_expenses ADD CONSTRAINT inventory_expenses_document_line_id_inventory_document_lines_id_fk FOREIGN KEY (document_line_id) REFERENCES inventory_document_lines(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_expenses ADD CONSTRAINT inventory_expenses_document_line_salon_id_fk FOREIGN KEY (document_line_id, salon_id) REFERENCES inventory_document_lines(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_expenses ADD CONSTRAINT inventory_expenses_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_expenses ADD CONSTRAINT inventory_expenses_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES inventory_suppliers(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_assets ADD CONSTRAINT inventory_assets_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE inventory_assets ADD CONSTRAINT inventory_assets_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES inventory_documents(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_assets ADD CONSTRAINT inventory_assets_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES inventory_documents(id, salon_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE inventory_assets ADD CONSTRAINT inventory_assets_document_line_id_inventory_document_lines_id_fk FOREIGN KEY (document_line_id) REFERENCES inventory_document_lines(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_assets ADD CONSTRAINT inventory_assets_document_line_salon_id_fk FOREIGN KEY (document_line_id, salon_id) REFERENCES inventory_document_lines(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_assets ADD CONSTRAINT inventory_assets_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_assets ADD CONSTRAINT inventory_assets_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES inventory_suppliers(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES inventory_documents(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES inventory_documents(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_line_id_inventory_document_lines_id_fk FOREIGN KEY (document_line_id) REFERENCES inventory_document_lines(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_line_salon_id_fk FOREIGN KEY (document_line_id, salon_id) REFERENCES inventory_document_lines(id, salon_id);
--> statement-breakpoint
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_reverses_movement_id_inventory_movements_id_fk FOREIGN KEY (reverses_movement_id) REFERENCES inventory_movements(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_reversal_salon_id_fk FOREIGN KEY (reverses_movement_id, salon_id) REFERENCES inventory_movements(id, salon_id);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION warehouse_document_lines_draft_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO parent_status
    FROM inventory_documents
    WHERE id = OLD.document_id AND salon_id = OLD.salon_id;
  ELSE
    SELECT status INTO parent_status
    FROM inventory_documents
    WHERE id = NEW.document_id AND salon_id = NEW.salon_id;
  END IF;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Warehouse document lines can only change while the parent document is draft';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER warehouse_document_lines_draft_guard
BEFORE INSERT OR UPDATE OR DELETE ON inventory_document_lines
FOR EACH ROW EXECUTE FUNCTION warehouse_document_lines_draft_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION warehouse_documents_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Posted, reversed, and cancelled warehouse documents are immutable';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN
    IF NEW.status NOT IN ('draft', 'posted') THEN
      RAISE EXCEPTION 'Draft warehouse documents may only remain draft or be posted';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
    RAISE EXCEPTION 'Posted, reversed, and cancelled warehouse document content is immutable';
  END IF;
  IF OLD.status = 'posted' AND NEW.status IN ('posted', 'reversed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('reversed', 'cancelled') AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Warehouse document status transition is not allowed';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER warehouse_documents_immutable_guard
BEFORE UPDATE OR DELETE ON inventory_documents
FOR EACH ROW EXECUTE FUNCTION warehouse_documents_immutable_guard();
--> statement-breakpoint

-- Technical opening documents establish the warehouse ledger boundary only. They deliberately
-- have no lines or movement links, so current product quantities remain authoritative.
INSERT INTO inventory_documents (salon_id, internal_number, kind, status, document_date, competence_date, net_total_cents, tax_total_cents, total_cents, posted_at)
SELECT salons.id, 'OPENING-' || salons.id::text, 'opening', 'posted', now(), now(), 0, 0, 0, now()
FROM salons
ON CONFLICT (salon_id, internal_number) DO NOTHING;
