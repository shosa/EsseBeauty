CREATE OR REPLACE FUNCTION warehouse_document_lines_draft_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_parent_status text;
  new_parent_status text;
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM salons WHERE id = OLD.salon_id) THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status
    INTO old_parent_status
    FROM inventory_documents
    WHERE id = OLD.document_id
      AND salon_id = OLD.salon_id;

    IF old_parent_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION
        'Warehouse document lines can only change while the old parent document is draft';
    END IF;

  ELSIF TG_OP = 'INSERT' THEN
    SELECT status
    INTO new_parent_status
    FROM inventory_documents
    WHERE id = NEW.document_id
      AND salon_id = NEW.salon_id;

    IF new_parent_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION
        'Warehouse document lines can only change while the new parent document is draft';
    END IF;

  ELSE
    IF OLD.document_id <> NEW.document_id
       OR OLD.salon_id <> NEW.salon_id THEN
      RAISE EXCEPTION
        'Warehouse document lines cannot move between documents or salons';
    END IF;

    SELECT status
    INTO old_parent_status
    FROM inventory_documents
    WHERE id = OLD.document_id
      AND salon_id = OLD.salon_id;

    SELECT status
    INTO new_parent_status
    FROM inventory_documents
    WHERE id = NEW.document_id
      AND salon_id = NEW.salon_id;

    IF old_parent_status IS DISTINCT FROM 'draft'
       OR new_parent_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION
        'Warehouse document lines can only change while both parent versions are draft';
    END IF;
  END IF;

  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION warehouse_documents_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM salons WHERE id = OLD.salon_id) THEN
      RETURN OLD;
    END IF;

    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION
        'Posted, reversed, and cancelled warehouse documents are immutable';
    END IF;

    RETURN OLD;
  END IF;

  IF OLD.status = 'draft' THEN
    IF NEW.status NOT IN ('draft', 'posted') THEN
      RAISE EXCEPTION
        'Draft warehouse documents may only remain draft or be posted';
    END IF;

    RETURN NEW;
  END IF;

  IF (
    to_jsonb(NEW) - 'status' - 'updated_at'
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - 'status' - 'updated_at'
  ) THEN
    RAISE EXCEPTION
      'Posted, reversed, and cancelled warehouse document content is immutable';
  END IF;

  IF OLD.status = 'posted'
     AND NEW.status IN ('posted', 'reversed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('reversed', 'cancelled')
     AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Warehouse document status transition is not allowed';
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION warehouse_monetary_rows_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM salons WHERE id = OLD.salon_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Warehouse monetary rows are immutable';
END;
$$;
