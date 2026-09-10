--
-- PostgreSQL database dump
--

\restrict nZFnzooDF142od9uYh5q1zmDrWccnjheatKxSvIcA1BflkXwLFF7QLi4ohPA29n

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: appointment_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_source AS ENUM (
    'online',
    'manual',
    'walk_in'
);


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'no_show',
    'completed'
);


--
-- Name: campaign_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.campaign_channel AS ENUM (
    'email',
    'whatsapp',
    'app'
);


--
-- Name: campaign_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.campaign_status AS ENUM (
    'draft',
    'scheduled',
    'sent',
    'failed',
    'queued',
    'processing',
    'partial',
    'cancelled'
);


--
-- Name: communication_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_channel AS ENUM (
    'email',
    'sms',
    'whatsapp'
);


--
-- Name: communication_consent_purpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_consent_purpose AS ENUM (
    'marketing',
    'transactional'
);


--
-- Name: communication_consent_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_consent_status AS ENUM (
    'granted',
    'revoked'
);


--
-- Name: communication_conversation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_conversation_status AS ENUM (
    'open',
    'closed',
    'archived'
);


--
-- Name: communication_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_direction AS ENUM (
    'inbound',
    'outbound'
);


--
-- Name: communication_message_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_message_kind AS ENUM (
    'text',
    'template',
    'media',
    'system'
);


--
-- Name: communication_message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_message_status AS ENUM (
    'queued',
    'accepted',
    'sent',
    'delivered',
    'read',
    'failed'
);


--
-- Name: communication_outbox_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_outbox_status AS ENUM (
    'pending',
    'processing',
    'delivered',
    'failed',
    'exhausted'
);


--
-- Name: communication_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_provider AS ENUM (
    'meta_cloud_api'
);


--
-- Name: communication_provider_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_provider_status AS ENUM (
    'not_configured',
    'pending_verification',
    'ready',
    'degraded',
    'revoked',
    'disabled'
);


--
-- Name: communication_secret_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.communication_secret_kind AS ENUM (
    'access_token',
    'webhook_verify_token'
);


--
-- Name: consent_delivery_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_delivery_channel AS ENUM (
    'email',
    'sms',
    'in_person',
    'whatsapp',
    'push'
);


--
-- Name: consent_signature_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_signature_status AS ENUM (
    'pending',
    'signed',
    'revoked',
    'expired'
);


--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel AS ENUM (
    'in_app',
    'email',
    'sms',
    'push',
    'whatsapp'
);


--
-- Name: notification_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_priority AS ENUM (
    'low',
    'normal',
    'high',
    'critical'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'bank_transfer',
    'voucher',
    'other'
);


--
-- Name: platform_salon_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_salon_status AS ENUM (
    'active',
    'suspended',
    'trial',
    'churn_risk'
);


--
-- Name: reminder_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reminder_channel AS ENUM (
    'sms',
    'email',
    'whatsapp',
    'app'
);


--
-- Name: reminder_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reminder_status AS ENUM (
    'pending',
    'sent',
    'failed',
    'queued'
);


--
-- Name: review_delivery_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_delivery_channel AS ENUM (
    'email',
    'sms',
    'whatsapp',
    'app'
);


--
-- Name: review_delivery_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_delivery_status AS ENUM (
    'pending',
    'processing',
    'sent',
    'failed',
    'skipped',
    'exhausted',
    'queued'
);


--
-- Name: reward_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reward_type AS ENUM (
    'free_treatment',
    'free_product',
    'fixed_discount',
    'percent_discount',
    'credit'
);


--
-- Name: sale_item_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sale_item_type AS ENUM (
    'service',
    'product',
    'custom'
);


--
-- Name: sale_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sale_status AS ENUM (
    'open',
    'paid',
    'void'
);


--
-- Name: staff_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.staff_request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'owner',
    'manager',
    'receptionist',
    'employee'
);


--
-- Name: waitlist_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.waitlist_status AS ENUM (
    'waiting',
    'notified',
    'booked',
    'expired'
);


--
-- Name: whatsapp_template_approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.whatsapp_template_approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'revoked'
);


--
-- Name: warehouse_document_lines_draft_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.warehouse_document_lines_draft_guard() RETURNS trigger
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


--
-- Name: warehouse_documents_immutable_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.warehouse_documents_immutable_guard() RETURNS trigger
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


--
-- Name: warehouse_monetary_rows_immutable_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.warehouse_monetary_rows_immutable_guard() RETURNS trigger
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    actor_user_id uuid,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    summary text NOT NULL,
    diff jsonb DEFAULT '{}'::jsonb NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    undo_payload jsonb,
    undo_expires_at timestamp with time zone,
    undone_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointment_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    author_user_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointment_reschedule_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_reschedule_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    requested_starts_at timestamp with time zone NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_by_user_id uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    status public.appointment_status NOT NULL,
    internal_notes text,
    source public.appointment_source NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    cancelled_by_user_id uuid,
    cancellation_reason text,
    confirmed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    resource_id uuid,
    paid_externally boolean DEFAULT false NOT NULL,
    checked_in_at timestamp with time zone
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    ip_address text,
    user_agent text
);


--
-- Name: availability_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    reason text,
    recurring boolean DEFAULT false NOT NULL,
    recurrence_rule text,
    location_id uuid
);


--
-- Name: calendar_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    min_slot_minutes integer DEFAULT 15 NOT NULL,
    buffer_minutes integer DEFAULT 0 NOT NULL,
    min_booking_notice_hours integer DEFAULT 2 NOT NULL,
    cancellation_policy_hours integer DEFAULT 24 NOT NULL,
    allow_overbooking boolean DEFAULT false NOT NULL,
    overbooking_limit integer DEFAULT 0 NOT NULL,
    default_view text DEFAULT 'day'::text NOT NULL,
    enable_resource_view boolean DEFAULT false NOT NULL,
    printable_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid,
    destination text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    provider_name text,
    provider_message_id text,
    delivery_attempts integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_recipients_delivery_attempts_non_negative CHECK ((delivery_attempts >= 0)),
    CONSTRAINT campaign_recipients_status_valid CHECK ((status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text, 'cancelled'::text])))
);


--
-- Name: campaign_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    channel public.campaign_channel NOT NULL,
    content text NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    whatsapp_template_name text,
    whatsapp_template_locale text,
    whatsapp_approval_status public.whatsapp_template_approval_status,
    whatsapp_approval_source text,
    whatsapp_approved_at timestamp with time zone
);


--
-- Name: cash_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    direction text NOT NULL,
    payment_method public.payment_method NOT NULL,
    amount_cents integer NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    reason text NOT NULL,
    category text NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    idempotency_key text NOT NULL,
    created_by_user_id uuid,
    reversed_by_movement_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cash_movements_amount_positive CHECK ((amount_cents > 0)),
    CONSTRAINT cash_movements_direction_valid CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: communication_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    channel public.communication_channel NOT NULL,
    purpose public.communication_consent_purpose NOT NULL,
    status public.communication_consent_status NOT NULL,
    captured_at timestamp with time zone NOT NULL,
    captured_source text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    revoked_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: communication_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    account_id uuid NOT NULL,
    customer_id uuid,
    participant_phone text NOT NULL,
    status public.communication_conversation_status DEFAULT 'open'::public.communication_conversation_status NOT NULL,
    assigned_user_id uuid,
    last_message_at timestamp with time zone,
    last_inbound_at timestamp with time zone,
    last_message_preview text,
    unread_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT communication_conversations_unread_non_negative CHECK ((unread_count >= 0))
);


--
-- Name: communication_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    account_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    direction public.communication_direction NOT NULL,
    kind public.communication_message_kind NOT NULL,
    body text,
    template_name text,
    template_locale text,
    template_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    provider_message_id text,
    client_idempotency_key text,
    source_type text,
    source_id uuid,
    actor_user_id uuid,
    status public.communication_message_status DEFAULT 'queued'::public.communication_message_status NOT NULL,
    provider_timestamp timestamp with time zone,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_code text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: communication_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    message_id uuid NOT NULL,
    status public.communication_outbox_status DEFAULT 'pending'::public.communication_outbox_status NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_owner text,
    lease_expires_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error_code text,
    delivered_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT communication_outbox_attempts_bounded CHECK ((attempts <= max_attempts)),
    CONSTRAINT communication_outbox_attempts_non_negative CHECK ((attempts >= 0)),
    CONSTRAINT communication_outbox_max_attempts_positive CHECK ((max_attempts > 0))
);


--
-- Name: communication_provider_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_provider_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    provider public.communication_provider DEFAULT 'meta_cloud_api'::public.communication_provider NOT NULL,
    waba_id text NOT NULL,
    phone_number_id text NOT NULL,
    display_phone_number text,
    business_portfolio_id text,
    graph_api_version text DEFAULT 'v23.0'::text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    status public.communication_provider_status DEFAULT 'not_configured'::public.communication_provider_status NOT NULL,
    webhook_key uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_subscription_status text DEFAULT 'not_subscribed'::text NOT NULL,
    token_expires_at timestamp with time zone,
    last_health_check_at timestamp with time zone,
    last_webhook_at timestamp with time zone,
    last_error_code text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: communication_provider_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_provider_secrets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    account_id uuid NOT NULL,
    kind public.communication_secret_kind NOT NULL,
    ciphertext text NOT NULL,
    initialization_vector text NOT NULL,
    authentication_tag text NOT NULL,
    key_version text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: communication_user_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_user_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    last_read_message_id uuid,
    muted boolean DEFAULT false NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    draft text DEFAULT ''::text NOT NULL,
    selected boolean DEFAULT false NOT NULL,
    last_opened_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: communication_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    account_id uuid NOT NULL,
    external_event_id text NOT NULL,
    event_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    redacted_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    processed_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consent_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    body text NOT NULL,
    required_for_services jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_app_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_app_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    href text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    appointment_id uuid,
    template_id uuid NOT NULL,
    status public.consent_signature_status DEFAULT 'pending'::public.consent_signature_status NOT NULL,
    signed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    signature_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    token_hash text,
    expires_at timestamp with time zone,
    delivery_channel public.consent_delivery_channel,
    signer_name text,
    document_hash text,
    revoked_by_user_id uuid,
    revocation_reason text,
    CONSTRAINT customer_consents_document_hash_format CHECK (((document_hash IS NULL) OR (document_hash ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT customer_consents_token_hash_format CHECK (((token_hash IS NULL) OR (token_hash ~ '^[a-f0-9]{64}$'::text)))
);


--
-- Name: customer_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    phone_normalized text NOT NULL,
    password_hash text NOT NULL,
    password_salt text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_package_item_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_package_item_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_package_id uuid NOT NULL,
    package_item_id uuid NOT NULL,
    total_quantity integer NOT NULL,
    used_quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_package_item_balances_total_positive CHECK ((total_quantity > 0)),
    CONSTRAINT customer_package_item_balances_used_non_negative CHECK ((used_quantity >= 0))
);


--
-- Name: customer_password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_service_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_service_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    package_id uuid NOT NULL,
    total_sessions integer NOT NULL,
    used_sessions integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_sale_id uuid
);


--
-- Name: customer_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    email text,
    phone text,
    full_name text NOT NULL,
    notes text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    blocked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    marketing_email_consent boolean DEFAULT false NOT NULL,
    marketing_sms_consent boolean DEFAULT false NOT NULL,
    marketing_unsubscribed_at timestamp with time zone,
    archived_at timestamp with time zone,
    merged_into_customer_id uuid,
    anonymized_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_normalized text,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    birthday text
);


--
-- Name: COLUMN customers.marketing_sms_consent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.marketing_sms_consent IS 'Historical SMS consent only. New WhatsApp marketing eligibility is recorded in communication_consents.';


--
-- Name: data_exchange_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_exchange_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    entity_type text NOT NULL,
    export_formats jsonb DEFAULT '["csv"]'::jsonb NOT NULL,
    import_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: integration_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    provider text NOT NULL,
    label text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    secret_ref text,
    last_sync_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_line_id uuid,
    supplier_id uuid,
    description text NOT NULL,
    serial_number text,
    purchase_date timestamp with time zone NOT NULL,
    purchase_cost_cents integer DEFAULT 0 NOT NULL,
    reverses_asset_id uuid,
    warranty_expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    disposed_at timestamp with time zone,
    disposal_notes text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cash_movement_id uuid,
    idempotency_key text,
    location text,
    disposed_by_user_id uuid,
    CONSTRAINT inventory_assets_signed_purchase_cost CHECK ((((reverses_asset_id IS NULL) AND (purchase_cost_cents >= 0)) OR ((reverses_asset_id IS NOT NULL) AND (purchase_cost_cents <= 0)))),
    CONSTRAINT inventory_assets_status_valid CHECK ((status = ANY (ARRAY['active'::text, 'disposed'::text])))
);


--
-- Name: inventory_count_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_count_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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


--
-- Name: inventory_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_counts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    document_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    category text,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    posted_at timestamp with time zone,
    created_by_user_id uuid,
    posted_by_user_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_counts_status_valid CHECK ((status = ANY (ARRAY['draft'::text, 'counting'::text, 'posted'::text, 'cancelled'::text])))
);


--
-- Name: inventory_document_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_document_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    salon_id uuid NOT NULL,
    product_id uuid,
    supplier_id uuid,
    line_number integer NOT NULL,
    description text NOT NULL,
    item_type text DEFAULT 'resale'::text NOT NULL,
    quantity integer NOT NULL,
    unit text DEFAULT 'pz'::text NOT NULL,
    unit_scale integer DEFAULT 1 NOT NULL,
    stock_delta integer DEFAULT 0 NOT NULL,
    unit_cost_cents integer DEFAULT 0 NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    tax_rate_basis_points integer DEFAULT 0 NOT NULL,
    net_cents integer DEFAULT 0 NOT NULL,
    tax_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    reverses_document_line_id uuid,
    destination text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_document_lines_discount_non_negative CHECK ((discount_cents >= 0)),
    CONSTRAINT inventory_document_lines_item_type_valid CHECK ((item_type = ANY (ARRAY['resale'::text, 'consumable'::text, 'equipment'::text, 'expense'::text]))),
    CONSTRAINT inventory_document_lines_signed_amounts CHECK ((((reverses_document_line_id IS NULL) AND (net_cents >= 0) AND (tax_cents >= 0) AND (total_cents >= 0)) OR ((reverses_document_line_id IS NOT NULL) AND (net_cents <= 0) AND (tax_cents <= 0) AND (total_cents <= 0)))),
    CONSTRAINT inventory_document_lines_unit_cost_non_negative CHECK ((unit_cost_cents >= 0)),
    CONSTRAINT inventory_document_lines_unit_scale_positive CHECK ((unit_scale > 0))
);


--
-- Name: inventory_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    internal_number text NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
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
    CONSTRAINT inventory_documents_kind_valid CHECK ((kind = ANY (ARRAY['opening'::text, 'purchase'::text, 'supplier_invoice'::text, 'internal_use'::text, 'waste'::text, 'supplier_return'::text, 'adjustment'::text, 'count'::text, 'credit_note'::text, 'equipment_purchase'::text, 'expense'::text]))),
    CONSTRAINT inventory_documents_signed_totals CHECK ((((reversal_of_document_id IS NULL) AND (net_total_cents >= 0) AND (tax_total_cents >= 0) AND (total_cents >= 0)) OR ((reversal_of_document_id IS NOT NULL) AND (net_total_cents <= 0) AND (tax_total_cents <= 0) AND (total_cents <= 0)))),
    CONSTRAINT inventory_documents_status_valid CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'cancelled'::text, 'reversed'::text])))
);


--
-- Name: inventory_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
    reverses_expense_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cash_movement_id uuid,
    idempotency_key text,
    CONSTRAINT inventory_expenses_signed_amounts CHECK ((((reverses_expense_id IS NULL) AND (net_cents >= 0) AND (tax_cents >= 0) AND (total_cents >= 0)) OR ((reverses_expense_id IS NOT NULL) AND (net_cents <= 0) AND (tax_cents <= 0) AND (total_cents <= 0))))
);


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    product_id uuid NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    appointment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    stock_after integer,
    note text,
    document_id uuid,
    document_line_id uuid,
    movement_type text,
    stock_before integer,
    unit_cost_cents integer,
    value_cents integer,
    reverses_movement_id uuid,
    sale_id uuid
);


--
-- Name: inventory_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    stock_quantity integer DEFAULT 0 NOT NULL,
    low_stock_threshold integer DEFAULT 0 NOT NULL,
    unit_price_cents integer NOT NULL,
    supplier text,
    active boolean DEFAULT true NOT NULL,
    category text,
    barcode text,
    cost_cents integer,
    reorder_quantity integer DEFAULT 0 NOT NULL,
    preferred_supplier text,
    allow_negative_stock boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    item_type text DEFAULT 'resale'::text NOT NULL,
    unit text DEFAULT 'pz'::text NOT NULL,
    unit_scale integer DEFAULT 1 NOT NULL,
    track_stock boolean DEFAULT true NOT NULL,
    sellable boolean DEFAULT true NOT NULL,
    internally_consumable boolean DEFAULT false NOT NULL,
    average_cost_cents integer DEFAULT 0 NOT NULL,
    last_cost_cents integer DEFAULT 0 NOT NULL,
    preferred_supplier_id uuid,
    description text,
    brand text,
    manufacturer_code text,
    vat_rate_basis_points integer DEFAULT 2200 NOT NULL,
    storage_location text,
    notes text,
    CONSTRAINT inventory_products_item_type_valid CHECK ((item_type = ANY (ARRAY['resale'::text, 'consumable'::text, 'equipment'::text, 'expense'::text]))),
    CONSTRAINT inventory_products_unit_scale_positive CHECK ((unit_scale > 0))
);


--
-- Name: inventory_reorder_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_reorder_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    supplier text,
    notes text,
    created_by_user_id uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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


--
-- Name: login_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid,
    user_id uuid,
    email text NOT NULL,
    success boolean NOT NULL,
    failure_reason text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loyalty_adjustment_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_adjustment_reasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    requires_note boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loyalty_earning_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_earning_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    action text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_earning_rules_points_non_negative CHECK ((points >= 0))
);


--
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    appointment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    expired_at timestamp with time zone,
    adjustment_reason_id uuid,
    redemption_id uuid,
    sale_id uuid,
    rule_key text,
    created_by_user_id uuid
);


--
-- Name: loyalty_reward_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_reward_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    reward_id uuid NOT NULL,
    points_spent integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by_user_id uuid,
    redeemed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text,
    sale_id uuid,
    applied_type public.reward_type,
    applied_discount_cents integer,
    applied_service_id uuid,
    applied_product_id uuid,
    CONSTRAINT loyalty_redemptions_points_positive CHECK ((points_spent > 0))
);


--
-- Name: loyalty_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    points_required integer NOT NULL,
    description text,
    active boolean DEFAULT true NOT NULL,
    type public.reward_type DEFAULT 'fixed_discount'::public.reward_type NOT NULL,
    service_id uuid,
    product_id uuid,
    discount_amount_cents integer,
    discount_percent integer,
    min_spend_cents integer,
    max_discount_cents integer,
    CONSTRAINT loyalty_rewards_max_discount_non_negative CHECK (((max_discount_cents IS NULL) OR (max_discount_cents >= 0))),
    CONSTRAINT loyalty_rewards_min_spend_non_negative CHECK (((min_spend_cents IS NULL) OR (min_spend_cents >= 0)))
);


--
-- Name: loyalty_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    points_per_appointment integer DEFAULT 10 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    points_expire_after_days integer,
    allow_negative_balance boolean DEFAULT false NOT NULL,
    redemption_requires_approval boolean DEFAULT true NOT NULL
);


--
-- Name: loyalty_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    min_points integer DEFAULT 0 NOT NULL,
    benefits jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_tiers_min_points_non_negative CHECK ((min_points >= 0))
);


--
-- Name: marketing_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    channel public.campaign_channel NOT NULL,
    target_segment jsonb NOT NULL,
    content text NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    status public.campaign_status DEFAULT 'draft'::public.campaign_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    template_id uuid,
    reviewed_at timestamp with time zone,
    approved_by_user_id uuid,
    recipient_preview jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_started_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    whatsapp_template_name text,
    whatsapp_template_locale text,
    whatsapp_template_parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
    whatsapp_template_approval_status public.whatsapp_template_approval_status
);


--
-- Name: COLUMN marketing_campaigns.channel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.marketing_campaigns.channel IS 'Historical SMS campaigns remain read-only. New WhatsApp campaigns require an approved template.';


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    role public.user_role NOT NULL,
    category text NOT NULL,
    channel public.notification_channel NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    quiet_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    user_id uuid,
    target_role public.user_role,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    entity_type text,
    entity_id uuid,
    read_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    priority public.notification_priority DEFAULT 'normal'::public.notification_priority NOT NULL,
    channel public.notification_channel DEFAULT 'in_app'::public.notification_channel NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_admin_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admin_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    password_hash text NOT NULL,
    password_salt text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_admin_id uuid,
    salon_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    summary text NOT NULL,
    diff jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_email_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_email_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'smtp'::text NOT NULL,
    host text DEFAULT ''::text NOT NULL,
    port integer DEFAULT 587 NOT NULL,
    secure boolean DEFAULT false NOT NULL,
    username text,
    password_encrypted text,
    default_from_name text DEFAULT 'EsseBeauty'::text NOT NULL,
    default_from_email text DEFAULT 'noreply@essebeauty.app'::text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    last_health_check_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_impersonation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_impersonation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    salon_id uuid NOT NULL,
    user_id uuid,
    reason text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: platform_module_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_module_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_key text NOT NULL,
    name text NOT NULL,
    description text,
    globally_enabled boolean DEFAULT true NOT NULL,
    default_enabled boolean DEFAULT false NOT NULL,
    configuration_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    included_modules jsonb DEFAULT '[]'::jsonb NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_system_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_system_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    channel public.notification_channel DEFAULT 'email'::public.notification_channel NOT NULL,
    subject text,
    body text NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_voucher_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_voucher_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    voucher_id uuid NOT NULL,
    sale_id uuid,
    delta_cents integer NOT NULL,
    balance_after_cents integer NOT NULL,
    reason text NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    code text NOT NULL,
    customer_id uuid NOT NULL,
    purchaser_customer_id uuid,
    issued_sale_id uuid,
    original_amount_cents integer NOT NULL,
    balance_cents integer NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    message text,
    issued_by_user_id uuid,
    exhausted_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_reward_redemption_id uuid,
    CONSTRAINT purchase_vouchers_balance_non_negative CHECK ((balance_cents >= 0)),
    CONSTRAINT purchase_vouchers_original_positive CHECK ((original_amount_cents > 0))
);


--
-- Name: pwa_branding_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pwa_branding_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    logo_url text,
    primary_color text,
    accent_color text,
    hero_title text,
    hero_subtitle text,
    welcome_text text,
    booking_success_text text,
    install_prompt_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reminder_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminder_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    whatsapp_enabled boolean DEFAULT false NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    hours_before jsonb DEFAULT '[24]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    app_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    channel public.reminder_channel NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    status public.reminder_status DEFAULT 'pending'::public.reminder_status NOT NULL,
    payload jsonb NOT NULL
);


--
-- Name: COLUMN reminders.channel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reminders.channel IS 'Historical SMS reminder rows remain truthful. New reminder writes use whatsapp or email.';


--
-- Name: review_invitation_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_invitation_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invitation_id uuid NOT NULL,
    salon_id uuid NOT NULL,
    channel public.review_delivery_channel NOT NULL,
    generation integer DEFAULT 0 NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    delivered_at timestamp with time zone,
    last_attempt_at timestamp with time zone,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_invitation_deliveries_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT review_invitation_deliveries_channel_check CHECK (((channel)::text = ANY (ARRAY['email'::text, 'whatsapp'::text, 'app'::text]))),
    CONSTRAINT review_invitation_deliveries_generation_check CHECK ((generation >= 0)),
    CONSTRAINT review_invitation_deliveries_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'processing'::text, 'delivered'::text, 'queued'::text, 'failed'::text, 'skipped'::text, 'exhausted'::text])))
);


--
-- Name: review_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    token_hash text,
    channel public.review_delivery_channel NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    delivery_status public.review_delivery_status DEFAULT 'pending'::public.review_delivery_status NOT NULL,
    delivery_attempts integer DEFAULT 0 NOT NULL,
    last_delivery_attempt_at timestamp with time zone,
    delivered_at timestamp with time zone,
    delivery_failure text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_claim_id uuid,
    delivery_lease_expires_at timestamp with time zone,
    delivery_generation integer DEFAULT 0 NOT NULL,
    CONSTRAINT review_invitations_delivery_attempts_non_negative CHECK ((delivery_attempts >= 0)),
    CONSTRAINT review_invitations_delivery_generation_non_negative CHECK ((delivery_generation >= 0)),
    CONSTRAINT review_invitations_token_hash_format CHECK (((token_hash IS NULL) OR (token_hash ~ '^[a-f0-9]{64}$'::text)))
);


--
-- Name: COLUMN review_invitations.channel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.review_invitations.channel IS 'Historical SMS review rows remain truthful. New fallback writes use whatsapp.';


--
-- Name: review_request_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_request_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    automatic_enabled boolean DEFAULT false NOT NULL,
    delay_preset text DEFAULT 'one_hour'::text NOT NULL,
    channels jsonb DEFAULT '["email"]'::jsonb NOT NULL,
    updated_by_user_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_request_settings_channels_check CHECK (((jsonb_array_length(channels) > 0) AND (channels <@ '["email", "whatsapp", "app"]'::jsonb))),
    CONSTRAINT review_request_settings_delay_check CHECK ((delay_preset = ANY (ARRAY['immediate'::text, 'one_hour'::text, 'three_hours'::text, 'next_day'::text, 'two_days'::text])))
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    reply text,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    salon_id uuid NOT NULL,
    item_type public.sale_item_type NOT NULL,
    service_id uuid,
    product_id uuid,
    staff_id uuid,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_cents integer NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    total_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sale_items_discount_non_negative CHECK ((discount_cents >= 0)),
    CONSTRAINT sale_items_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT sale_items_total_non_negative CHECK ((total_cents >= 0)),
    CONSTRAINT sale_items_unit_price_non_negative CHECK ((unit_price_cents >= 0))
);


--
-- Name: sale_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    salon_id uuid NOT NULL,
    method public.payment_method NOT NULL,
    amount_cents integer NOT NULL,
    reference text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    voucher_id uuid,
    CONSTRAINT sale_payments_amount_positive CHECK ((amount_cents > 0))
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    appointment_id uuid,
    customer_id uuid,
    staff_id uuid,
    status public.sale_status DEFAULT 'open'::public.sale_status NOT NULL,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    notes text,
    closed_at timestamp with time zone,
    closed_by_user_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    voided_at timestamp with time zone,
    voided_by_user_id uuid,
    void_reason text,
    CONSTRAINT sales_discount_non_negative CHECK ((discount_cents >= 0)),
    CONSTRAINT sales_subtotal_non_negative CHECK ((subtotal_cents >= 0)),
    CONSTRAINT sales_total_non_negative CHECK ((total_cents >= 0))
);


--
-- Name: salon_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_closures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    date text NOT NULL,
    reason text,
    recurring_yearly boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: salon_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    email text,
    timezone text,
    active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);


--
-- Name: salon_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    module_key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: salon_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    location_id uuid,
    name text NOT NULL,
    type text NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: salon_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    category text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by_user_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: salon_special_opening_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_special_opening_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    special_opening_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    periods jsonb
);


--
-- Name: salon_special_openings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_special_openings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    date text NOT NULL,
    reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    periods jsonb NOT NULL
);


--
-- Name: salons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    timezone text NOT NULL,
    locale text NOT NULL,
    plan_id text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    opening_hours jsonb DEFAULT '{"fri": [{"to": "18:00", "from": "09:00"}], "mon": [{"to": "18:00", "from": "09:00"}], "sat": [], "sun": [], "thu": [{"to": "18:00", "from": "09:00"}], "tue": [{"to": "18:00", "from": "09:00"}], "wed": [{"to": "18:00", "from": "09:00"}]}'::jsonb NOT NULL,
    cancellation_policy_hours integer DEFAULT 24 NOT NULL,
    online_booking_enabled boolean DEFAULT true NOT NULL,
    address text,
    phone text,
    email text,
    brand_color text,
    booking_policy_text text,
    cancellation_policy_text text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    platform_status public.platform_salon_status DEFAULT 'active'::public.platform_salon_status NOT NULL,
    trial_ends_at timestamp with time zone,
    suspended_at timestamp with time zone,
    churn_risk_score integer DEFAULT 0 NOT NULL,
    onboarding_step integer DEFAULT 1 NOT NULL,
    onboarding_completed_at timestamp with time zone,
    city text,
    postal_code text,
    province text,
    country text DEFAULT 'Italia'::text,
    latitude double precision,
    longitude double precision
);


--
-- Name: saved_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    user_id uuid,
    entity_type text NOT NULL,
    name text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    columns jsonb,
    sort jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    icon text DEFAULT 'sparkles'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_package_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_package_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    package_id uuid NOT NULL,
    item_type public.sale_item_type NOT NULL,
    service_id uuid,
    product_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_package_items_quantity_positive CHECK ((quantity > 0))
);


--
-- Name: service_package_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_package_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    customer_package_id uuid NOT NULL,
    appointment_id uuid,
    sessions_used integer DEFAULT 1 NOT NULL,
    note text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sale_id uuid,
    sale_item_id uuid,
    package_item_id uuid,
    quantity_used integer DEFAULT 1 NOT NULL
);


--
-- Name: service_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    service_id uuid,
    included_sessions integer NOT NULL,
    validity_days integer,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    price_cents integer DEFAULT 0 NOT NULL
);


--
-- Name: service_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    service_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    required boolean DEFAULT true NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    service_id uuid NOT NULL,
    staff_id uuid NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    price_cents integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    online_booking_enabled boolean DEFAULT true NOT NULL,
    buffer_before_minutes integer DEFAULT 0 NOT NULL,
    buffer_after_minutes integer DEFAULT 0 NOT NULL,
    color text,
    tax_rate_basis_points integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category_id uuid
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    user_id uuid,
    display_name text NOT NULL,
    bio text,
    specializations text[] DEFAULT '{}'::text[] NOT NULL,
    working_hours jsonb NOT NULL,
    color text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    job_title text,
    phone text,
    email text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid
);


--
-- Name: staff_availability_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_availability_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    reason text,
    status public.staff_request_status DEFAULT 'pending'::public.staff_request_status NOT NULL,
    reviewed_by_user_id uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_credentials (
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    password_salt text NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_interface_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_interface_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    navigation_collapsed boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    salon_id uuid NOT NULL,
    permission_key text NOT NULL,
    granted boolean NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    salon_id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role public.user_role NOT NULL,
    avatar_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: waitlist_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salon_id uuid NOT NULL,
    service_id uuid NOT NULL,
    staff_id uuid,
    customer_id uuid NOT NULL,
    requested_date timestamp with time zone NOT NULL,
    status public.waitlist_status DEFAULT 'waiting'::public.waitlist_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    time_preference text DEFAULT 'any'::text NOT NULL,
    CONSTRAINT waitlist_entries_time_preference_check CHECK ((time_preference = ANY (ARRAY['any'::text, 'morning'::text, 'afternoon'::text, 'evening'::text])))
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: appointment_notes appointment_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_notes
    ADD CONSTRAINT appointment_notes_pkey PRIMARY KEY (id);


--
-- Name: appointment_reschedule_requests appointment_reschedule_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reschedule_requests
    ADD CONSTRAINT appointment_reschedule_requests_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_token_hash_unique UNIQUE (token_hash);


--
-- Name: availability_blocks availability_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_pkey PRIMARY KEY (id);


--
-- Name: calendar_settings calendar_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_settings
    ADD CONSTRAINT calendar_settings_pkey PRIMARY KEY (id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: campaign_templates campaign_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_templates
    ADD CONSTRAINT campaign_templates_pkey PRIMARY KEY (id);


--
-- Name: cash_movements cash_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_pkey PRIMARY KEY (id);


--
-- Name: communication_consents communication_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_consents
    ADD CONSTRAINT communication_consents_pkey PRIMARY KEY (id);


--
-- Name: communication_conversations communication_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_conversations
    ADD CONSTRAINT communication_conversations_pkey PRIMARY KEY (id);


--
-- Name: communication_messages communication_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_pkey PRIMARY KEY (id);


--
-- Name: communication_outbox communication_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_outbox
    ADD CONSTRAINT communication_outbox_pkey PRIMARY KEY (id);


--
-- Name: communication_provider_accounts communication_provider_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_provider_accounts
    ADD CONSTRAINT communication_provider_accounts_pkey PRIMARY KEY (id);


--
-- Name: communication_provider_secrets communication_provider_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_provider_secrets
    ADD CONSTRAINT communication_provider_secrets_pkey PRIMARY KEY (id);


--
-- Name: communication_user_state communication_user_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_user_state
    ADD CONSTRAINT communication_user_state_pkey PRIMARY KEY (id);


--
-- Name: communication_webhook_events communication_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_webhook_events
    ADD CONSTRAINT communication_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: consent_templates consent_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_pkey PRIMARY KEY (id);


--
-- Name: customer_app_messages customer_app_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_app_messages
    ADD CONSTRAINT customer_app_messages_pkey PRIMARY KEY (id);


--
-- Name: customer_consents customer_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_consents
    ADD CONSTRAINT customer_consents_pkey PRIMARY KEY (id);


--
-- Name: customer_credentials customer_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_pkey PRIMARY KEY (id);


--
-- Name: customer_package_item_balances customer_package_item_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_package_item_balances
    ADD CONSTRAINT customer_package_item_balances_pkey PRIMARY KEY (id);


--
-- Name: customer_password_reset_tokens customer_password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_password_reset_tokens
    ADD CONSTRAINT customer_password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: customer_password_reset_tokens customer_password_reset_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_password_reset_tokens
    ADD CONSTRAINT customer_password_reset_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: customer_push_subscriptions customer_push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_subscriptions
    ADD CONSTRAINT customer_push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: customer_service_packages customer_service_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_packages
    ADD CONSTRAINT customer_service_packages_pkey PRIMARY KEY (id);


--
-- Name: customer_sessions customer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_pkey PRIMARY KEY (id);


--
-- Name: customer_sessions customer_sessions_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_token_hash_unique UNIQUE (token_hash);


--
-- Name: customer_tags customer_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT customer_tags_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: data_exchange_settings data_exchange_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_exchange_settings
    ADD CONSTRAINT data_exchange_settings_pkey PRIMARY KEY (id);


--
-- Name: integration_settings integration_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_settings
    ADD CONSTRAINT integration_settings_pkey PRIMARY KEY (id);


--
-- Name: inventory_assets inventory_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_pkey PRIMARY KEY (id);


--
-- Name: inventory_count_lines inventory_count_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_lines
    ADD CONSTRAINT inventory_count_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_counts inventory_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_pkey PRIMARY KEY (id);


--
-- Name: inventory_document_lines inventory_document_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_documents inventory_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_pkey PRIMARY KEY (id);


--
-- Name: inventory_expenses inventory_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_products inventory_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_products
    ADD CONSTRAINT inventory_products_pkey PRIMARY KEY (id);


--
-- Name: inventory_reorder_requests inventory_reorder_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reorder_requests
    ADD CONSTRAINT inventory_reorder_requests_pkey PRIMARY KEY (id);


--
-- Name: inventory_suppliers inventory_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_pkey PRIMARY KEY (id);


--
-- Name: login_activity login_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_activity
    ADD CONSTRAINT login_activity_pkey PRIMARY KEY (id);


--
-- Name: loyalty_adjustment_reasons loyalty_adjustment_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_adjustment_reasons
    ADD CONSTRAINT loyalty_adjustment_reasons_pkey PRIMARY KEY (id);


--
-- Name: loyalty_earning_rules loyalty_earning_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_earning_rules
    ADD CONSTRAINT loyalty_earning_rules_pkey PRIMARY KEY (id);


--
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_pkey PRIMARY KEY (id);


--
-- Name: loyalty_rewards loyalty_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id);


--
-- Name: loyalty_settings loyalty_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_settings
    ADD CONSTRAINT loyalty_settings_pkey PRIMARY KEY (id);


--
-- Name: loyalty_tiers loyalty_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_tiers
    ADD CONSTRAINT loyalty_tiers_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: platform_admin_sessions platform_admin_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_sessions
    ADD CONSTRAINT platform_admin_sessions_pkey PRIMARY KEY (id);


--
-- Name: platform_admin_sessions platform_admin_sessions_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_sessions
    ADD CONSTRAINT platform_admin_sessions_token_hash_unique UNIQUE (token_hash);


--
-- Name: platform_admins platform_admins_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_email_unique UNIQUE (email);


--
-- Name: platform_admins platform_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (id);


--
-- Name: platform_audit_log platform_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_log
    ADD CONSTRAINT platform_audit_log_pkey PRIMARY KEY (id);


--
-- Name: platform_email_settings platform_email_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_email_settings
    ADD CONSTRAINT platform_email_settings_pkey PRIMARY KEY (id);


--
-- Name: platform_impersonation_sessions platform_impersonation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_impersonation_sessions
    ADD CONSTRAINT platform_impersonation_sessions_pkey PRIMARY KEY (id);


--
-- Name: platform_module_catalog platform_module_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_module_catalog
    ADD CONSTRAINT platform_module_catalog_pkey PRIMARY KEY (id);


--
-- Name: platform_plans platform_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_plans
    ADD CONSTRAINT platform_plans_pkey PRIMARY KEY (id);


--
-- Name: platform_system_templates platform_system_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_system_templates
    ADD CONSTRAINT platform_system_templates_pkey PRIMARY KEY (id);


--
-- Name: purchase_voucher_movements purchase_voucher_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_voucher_movements
    ADD CONSTRAINT purchase_voucher_movements_pkey PRIMARY KEY (id);


--
-- Name: purchase_vouchers purchase_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_vouchers
    ADD CONSTRAINT purchase_vouchers_pkey PRIMARY KEY (id);


--
-- Name: pwa_branding_settings pwa_branding_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pwa_branding_settings
    ADD CONSTRAINT pwa_branding_settings_pkey PRIMARY KEY (id);


--
-- Name: reminder_settings reminder_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_settings
    ADD CONSTRAINT reminder_settings_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: review_invitation_deliveries review_invitation_deliveries_identity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_invitation_deliveries
    ADD CONSTRAINT review_invitation_deliveries_identity_unique UNIQUE (invitation_id, channel, generation);


--
-- Name: review_invitation_deliveries review_invitation_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_invitation_deliveries
    ADD CONSTRAINT review_invitation_deliveries_pkey PRIMARY KEY (id);


--
-- Name: review_invitations review_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_invitations
    ADD CONSTRAINT review_invitations_pkey PRIMARY KEY (id);


--
-- Name: review_request_settings review_request_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_request_settings
    ADD CONSTRAINT review_request_settings_pkey PRIMARY KEY (id);


--
-- Name: review_request_settings review_request_settings_salon_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_request_settings
    ADD CONSTRAINT review_request_settings_salon_unique UNIQUE (salon_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_payments sale_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: salon_closures salon_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_closures
    ADD CONSTRAINT salon_closures_pkey PRIMARY KEY (id);


--
-- Name: salon_locations salon_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_locations
    ADD CONSTRAINT salon_locations_pkey PRIMARY KEY (id);


--
-- Name: salon_modules salon_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_modules
    ADD CONSTRAINT salon_modules_pkey PRIMARY KEY (id);


--
-- Name: salon_resources salon_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_resources
    ADD CONSTRAINT salon_resources_pkey PRIMARY KEY (id);


--
-- Name: salon_settings salon_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_settings
    ADD CONSTRAINT salon_settings_pkey PRIMARY KEY (id);


--
-- Name: salon_special_opening_staff salon_special_opening_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_special_opening_staff
    ADD CONSTRAINT salon_special_opening_staff_pkey PRIMARY KEY (id);


--
-- Name: salon_special_openings salon_special_openings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_special_openings
    ADD CONSTRAINT salon_special_openings_pkey PRIMARY KEY (id);


--
-- Name: salons salons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salons
    ADD CONSTRAINT salons_pkey PRIMARY KEY (id);


--
-- Name: salons salons_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salons
    ADD CONSTRAINT salons_slug_unique UNIQUE (slug);


--
-- Name: saved_views saved_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_package_items service_package_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_pkey PRIMARY KEY (id);


--
-- Name: service_package_usages service_package_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_pkey PRIMARY KEY (id);


--
-- Name: service_packages service_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_pkey PRIMARY KEY (id);


--
-- Name: service_resources service_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_resources
    ADD CONSTRAINT service_resources_pkey PRIMARY KEY (id);


--
-- Name: service_staff service_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: staff_availability_requests staff_availability_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_availability_requests
    ADD CONSTRAINT staff_availability_requests_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: user_credentials user_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_pkey PRIMARY KEY (user_id);


--
-- Name: user_interface_preferences user_interface_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_interface_preferences
    ADD CONSTRAINT user_interface_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: waitlist_entries waitlist_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entries
    ADD CONSTRAINT waitlist_entries_pkey PRIMARY KEY (id);


--
-- Name: calendar_settings_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX calendar_settings_salon_unique ON public.calendar_settings USING btree (salon_id);


--
-- Name: campaign_recipients_campaign_destination_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_recipients_campaign_destination_unique ON public.campaign_recipients USING btree (campaign_id, destination);


--
-- Name: campaign_recipients_campaign_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_recipients_campaign_status_idx ON public.campaign_recipients USING btree (campaign_id, status);


--
-- Name: cash_movements_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cash_movements_id_salon_unique ON public.cash_movements USING btree (id, salon_id);


--
-- Name: cash_movements_salon_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cash_movements_salon_idempotency_unique ON public.cash_movements USING btree (salon_id, idempotency_key);


--
-- Name: communication_consents_marketing_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_consents_marketing_lookup_idx ON public.communication_consents USING btree (salon_id, channel, purpose, status);


--
-- Name: communication_consents_scope_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_consents_scope_unique ON public.communication_consents USING btree (salon_id, customer_id, channel, purpose);


--
-- Name: communication_conversations_account_participant_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_conversations_account_participant_unique ON public.communication_conversations USING btree (account_id, participant_phone);


--
-- Name: communication_conversations_salon_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_conversations_salon_activity_idx ON public.communication_conversations USING btree (salon_id, last_message_at);


--
-- Name: communication_messages_conversation_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_messages_conversation_created_idx ON public.communication_messages USING btree (conversation_id, created_at);


--
-- Name: communication_messages_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_messages_idempotency_unique ON public.communication_messages USING btree (account_id, client_idempotency_key);


--
-- Name: communication_messages_provider_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_messages_provider_id_unique ON public.communication_messages USING btree (account_id, provider_message_id);


--
-- Name: communication_outbox_claim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_outbox_claim_idx ON public.communication_outbox USING btree (status, available_at, lease_expires_at);


--
-- Name: communication_outbox_message_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_outbox_message_unique ON public.communication_outbox USING btree (message_id);


--
-- Name: communication_provider_accounts_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_provider_accounts_phone_unique ON public.communication_provider_accounts USING btree (phone_number_id);


--
-- Name: communication_provider_accounts_salon_provider_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_provider_accounts_salon_provider_unique ON public.communication_provider_accounts USING btree (salon_id, provider);


--
-- Name: communication_provider_accounts_waba_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_provider_accounts_waba_unique ON public.communication_provider_accounts USING btree (waba_id);


--
-- Name: communication_provider_accounts_webhook_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_provider_accounts_webhook_key_unique ON public.communication_provider_accounts USING btree (webhook_key);


--
-- Name: communication_provider_secrets_account_kind_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_provider_secrets_account_kind_unique ON public.communication_provider_secrets USING btree (account_id, kind);


--
-- Name: communication_provider_secrets_salon_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_provider_secrets_salon_account_idx ON public.communication_provider_secrets USING btree (salon_id, account_id);


--
-- Name: communication_user_state_scope_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_user_state_scope_unique ON public.communication_user_state USING btree (salon_id, user_id, conversation_id);


--
-- Name: communication_user_state_selected_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_user_state_selected_idx ON public.communication_user_state USING btree (salon_id, user_id, selected);


--
-- Name: communication_webhook_events_dedupe_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communication_webhook_events_dedupe_unique ON public.communication_webhook_events USING btree (account_id, external_event_id);


--
-- Name: communication_webhook_events_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communication_webhook_events_pending_idx ON public.communication_webhook_events USING btree (status, created_at);


--
-- Name: consent_templates_salon_name_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_templates_salon_name_version_unique ON public.consent_templates USING btree (salon_id, name, version);


--
-- Name: customer_consents_customer_template_appointment_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_consents_customer_template_appointment_unique ON public.customer_consents USING btree (customer_id, template_id, appointment_id);


--
-- Name: customer_consents_salon_token_hash_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_consents_salon_token_hash_unique ON public.customer_consents USING btree (salon_id, token_hash);


--
-- Name: customer_credentials_customer_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_credentials_customer_unique ON public.customer_credentials USING btree (customer_id);


--
-- Name: customer_credentials_salon_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_credentials_salon_phone_unique ON public.customer_credentials USING btree (salon_id, phone_normalized);


--
-- Name: customer_package_item_balances_package_item_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_package_item_balances_package_item_unique ON public.customer_package_item_balances USING btree (customer_package_id, package_item_id);


--
-- Name: customer_push_subscriptions_endpoint_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_push_subscriptions_endpoint_unique ON public.customer_push_subscriptions USING btree (endpoint);


--
-- Name: customer_tags_salon_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_tags_salon_name_unique ON public.customer_tags USING btree (salon_id, name);


--
-- Name: customers_salon_phone_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_salon_phone_normalized_idx ON public.customers USING btree (salon_id, phone_normalized);


--
-- Name: data_exchange_settings_salon_entity_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX data_exchange_settings_salon_entity_unique ON public.data_exchange_settings USING btree (salon_id, entity_type);


--
-- Name: integration_settings_salon_provider_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX integration_settings_salon_provider_unique ON public.integration_settings USING btree (salon_id, provider);


--
-- Name: inventory_assets_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_assets_id_salon_unique ON public.inventory_assets USING btree (id, salon_id);


--
-- Name: inventory_assets_salon_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_assets_salon_idempotency_unique ON public.inventory_assets USING btree (salon_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: inventory_assets_salon_purchase_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_assets_salon_purchase_date_idx ON public.inventory_assets USING btree (salon_id, purchase_date);


--
-- Name: inventory_count_lines_count_product_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_count_lines_count_product_unique ON public.inventory_count_lines USING btree (count_id, product_id);


--
-- Name: inventory_count_lines_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_count_lines_id_salon_unique ON public.inventory_count_lines USING btree (id, salon_id);


--
-- Name: inventory_count_lines_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_count_lines_product_idx ON public.inventory_count_lines USING btree (product_id);


--
-- Name: inventory_counts_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_counts_id_salon_unique ON public.inventory_counts USING btree (id, salon_id);


--
-- Name: inventory_counts_salon_status_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_counts_salon_status_date_idx ON public.inventory_counts USING btree (salon_id, status, opened_at);


--
-- Name: inventory_document_lines_document_line_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_document_lines_document_line_unique ON public.inventory_document_lines USING btree (document_id, line_number);


--
-- Name: inventory_document_lines_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_document_lines_id_salon_unique ON public.inventory_document_lines USING btree (id, salon_id);


--
-- Name: inventory_document_lines_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_document_lines_product_idx ON public.inventory_document_lines USING btree (product_id);


--
-- Name: inventory_documents_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_documents_id_salon_unique ON public.inventory_documents USING btree (id, salon_id);


--
-- Name: inventory_documents_salon_internal_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_documents_salon_internal_number_unique ON public.inventory_documents USING btree (salon_id, internal_number);


--
-- Name: inventory_documents_salon_status_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_documents_salon_status_date_idx ON public.inventory_documents USING btree (salon_id, status, document_date);


--
-- Name: inventory_expenses_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_expenses_id_salon_unique ON public.inventory_expenses USING btree (id, salon_id);


--
-- Name: inventory_expenses_salon_competence_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_expenses_salon_competence_date_idx ON public.inventory_expenses USING btree (salon_id, competence_date);


--
-- Name: inventory_expenses_salon_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_expenses_salon_idempotency_unique ON public.inventory_expenses USING btree (salon_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: inventory_movements_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_movements_id_salon_unique ON public.inventory_movements USING btree (id, salon_id);


--
-- Name: inventory_movements_salon_product_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_movements_salon_product_date_idx ON public.inventory_movements USING btree (salon_id, product_id, created_at);


--
-- Name: inventory_products_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_products_id_salon_unique ON public.inventory_products USING btree (id, salon_id);


--
-- Name: inventory_suppliers_id_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_suppliers_id_salon_unique ON public.inventory_suppliers USING btree (id, salon_id);


--
-- Name: inventory_suppliers_salon_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_suppliers_salon_active_idx ON public.inventory_suppliers USING btree (salon_id, active);


--
-- Name: inventory_suppliers_salon_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_suppliers_salon_name_unique ON public.inventory_suppliers USING btree (salon_id, name);


--
-- Name: loyalty_adjustment_reasons_salon_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_adjustment_reasons_salon_code_unique ON public.loyalty_adjustment_reasons USING btree (salon_id, code);


--
-- Name: loyalty_earning_rules_salon_action_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_earning_rules_salon_action_unique ON public.loyalty_earning_rules USING btree (salon_id, action);


--
-- Name: loyalty_points_appointment_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_points_appointment_unique ON public.loyalty_points USING btree (appointment_id);


--
-- Name: loyalty_points_redemption_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_points_redemption_unique ON public.loyalty_points USING btree (redemption_id);


--
-- Name: loyalty_points_sale_rule_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_points_sale_rule_unique ON public.loyalty_points USING btree (sale_id, rule_key);


--
-- Name: loyalty_redemptions_salon_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_redemptions_salon_idempotency_unique ON public.loyalty_reward_redemptions USING btree (salon_id, idempotency_key);


--
-- Name: loyalty_settings_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_settings_salon_unique ON public.loyalty_settings USING btree (salon_id);


--
-- Name: loyalty_tiers_salon_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_tiers_salon_name_unique ON public.loyalty_tiers USING btree (salon_id, name);


--
-- Name: loyalty_tiers_salon_threshold_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_tiers_salon_threshold_unique ON public.loyalty_tiers USING btree (salon_id, min_points);


--
-- Name: notification_preferences_salon_role_category_channel_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_preferences_salon_role_category_channel_unique ON public.notification_preferences USING btree (salon_id, role, category, channel);


--
-- Name: notifications_entity_role_type_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_entity_role_type_unique ON public.notifications USING btree (salon_id, entity_id, target_role, type);


--
-- Name: platform_module_catalog_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_module_catalog_key_unique ON public.platform_module_catalog USING btree (module_key);


--
-- Name: platform_plans_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_plans_code_unique ON public.platform_plans USING btree (code);


--
-- Name: platform_system_templates_key_channel_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_system_templates_key_channel_unique ON public.platform_system_templates USING btree (key, channel);


--
-- Name: purchase_vouchers_salon_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_vouchers_salon_code_unique ON public.purchase_vouchers USING btree (salon_id, code);


--
-- Name: pwa_branding_settings_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pwa_branding_settings_salon_unique ON public.pwa_branding_settings USING btree (salon_id);


--
-- Name: reminder_settings_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reminder_settings_salon_unique ON public.reminder_settings USING btree (salon_id);


--
-- Name: review_invitation_deliveries_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX review_invitation_deliveries_schedule_idx ON public.review_invitation_deliveries USING btree (status, scheduled_at);


--
-- Name: review_invitations_appointment_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX review_invitations_appointment_unique ON public.review_invitations USING btree (appointment_id);


--
-- Name: review_invitations_recovery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX review_invitations_recovery_idx ON public.review_invitations USING btree (delivery_status, delivery_lease_expires_at, expires_at);


--
-- Name: review_invitations_token_hash_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX review_invitations_token_hash_unique ON public.review_invitations USING btree (token_hash);


--
-- Name: reviews_appointment_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reviews_appointment_unique ON public.reviews USING btree (appointment_id);


--
-- Name: sales_appointment_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sales_appointment_unique ON public.sales USING btree (appointment_id);


--
-- Name: salon_closures_salon_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salon_closures_salon_date_unique ON public.salon_closures USING btree (salon_id, date);


--
-- Name: salon_locations_salon_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salon_locations_salon_name_unique ON public.salon_locations USING btree (salon_id, name);


--
-- Name: salon_modules_salon_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salon_modules_salon_key_unique ON public.salon_modules USING btree (salon_id, module_key);


--
-- Name: salon_resources_salon_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salon_resources_salon_name_unique ON public.salon_resources USING btree (salon_id, name);


--
-- Name: salon_settings_salon_category_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salon_settings_salon_category_unique ON public.salon_settings USING btree (salon_id, category);


--
-- Name: salon_special_opening_staff_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salon_special_opening_staff_unique ON public.salon_special_opening_staff USING btree (special_opening_id, staff_id);


--
-- Name: salon_special_openings_salon_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salon_special_openings_salon_date_unique ON public.salon_special_openings USING btree (salon_id, date);


--
-- Name: saved_views_user_entity_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX saved_views_user_entity_name_unique ON public.saved_views USING btree (user_id, entity_type, name);


--
-- Name: service_categories_salon_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_categories_salon_name_unique ON public.service_categories USING btree (salon_id, name);


--
-- Name: service_packages_salon_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_packages_salon_name_unique ON public.service_packages USING btree (salon_id, name);


--
-- Name: service_resources_service_resource_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_resources_service_resource_unique ON public.service_resources USING btree (service_id, resource_id);


--
-- Name: service_staff_service_staff_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_staff_service_staff_unique ON public.service_staff USING btree (service_id, staff_id);


--
-- Name: user_interface_preferences_user_salon_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_interface_preferences_user_salon_unique ON public.user_interface_preferences USING btree (user_id, salon_id);


--
-- Name: user_permissions_user_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_permissions_user_key_unique ON public.user_permissions USING btree (user_id, permission_key);


--
-- Name: users_salon_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_salon_email_unique ON public.users USING btree (salon_id, email);


--
-- Name: inventory_assets warehouse_assets_immutable_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER warehouse_assets_immutable_guard BEFORE DELETE OR UPDATE ON public.inventory_assets FOR EACH ROW EXECUTE FUNCTION public.warehouse_monetary_rows_immutable_guard();


--
-- Name: inventory_document_lines warehouse_document_lines_draft_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER warehouse_document_lines_draft_guard BEFORE INSERT OR DELETE OR UPDATE ON public.inventory_document_lines FOR EACH ROW EXECUTE FUNCTION public.warehouse_document_lines_draft_guard();


--
-- Name: inventory_documents warehouse_documents_immutable_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER warehouse_documents_immutable_guard BEFORE DELETE OR UPDATE ON public.inventory_documents FOR EACH ROW EXECUTE FUNCTION public.warehouse_documents_immutable_guard();


--
-- Name: inventory_expenses warehouse_expenses_immutable_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER warehouse_expenses_immutable_guard BEFORE DELETE OR UPDATE ON public.inventory_expenses FOR EACH ROW EXECUTE FUNCTION public.warehouse_monetary_rows_immutable_guard();


--
-- Name: activity_log activity_log_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: activity_log activity_log_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: appointment_notes appointment_notes_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_notes
    ADD CONSTRAINT appointment_notes_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_notes appointment_notes_author_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_notes
    ADD CONSTRAINT appointment_notes_author_user_id_users_id_fk FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: appointment_notes appointment_notes_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_notes
    ADD CONSTRAINT appointment_notes_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: appointment_reschedule_requests appointment_reschedule_requests_appointment_id_appointments_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reschedule_requests
    ADD CONSTRAINT appointment_reschedule_requests_appointment_id_appointments_id_ FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_reschedule_requests appointment_reschedule_requests_resolved_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reschedule_requests
    ADD CONSTRAINT appointment_reschedule_requests_resolved_by_user_id_users_id_fk FOREIGN KEY (resolved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: appointment_reschedule_requests appointment_reschedule_requests_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reschedule_requests
    ADD CONSTRAINT appointment_reschedule_requests_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_cancelled_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_cancelled_by_user_id_users_id_fk FOREIGN KEY (cancelled_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: appointments appointments_location_id_salon_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_location_id_salon_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.salon_locations(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_resource_id_salon_resources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_resource_id_salon_resources_id_fk FOREIGN KEY (resource_id) REFERENCES public.salon_resources(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: appointments appointments_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: auth_sessions auth_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: availability_blocks availability_blocks_location_id_salon_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_location_id_salon_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.salon_locations(id) ON DELETE SET NULL;


--
-- Name: availability_blocks availability_blocks_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: availability_blocks availability_blocks_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: calendar_settings calendar_settings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_settings
    ADD CONSTRAINT calendar_settings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_campaign_id_marketing_campaigns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_marketing_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: campaign_recipients campaign_recipients_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: campaign_templates campaign_templates_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_templates
    ADD CONSTRAINT campaign_templates_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: cash_movements cash_movements_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cash_movements cash_movements_reversed_by_movement_id_cash_movements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_reversed_by_movement_id_cash_movements_id_fk FOREIGN KEY (reversed_by_movement_id) REFERENCES public.cash_movements(id) ON DELETE SET NULL;


--
-- Name: cash_movements cash_movements_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_consents communication_consents_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_consents
    ADD CONSTRAINT communication_consents_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: communication_consents communication_consents_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_consents
    ADD CONSTRAINT communication_consents_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_conversations communication_conversations_account_id_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_conversations
    ADD CONSTRAINT communication_conversations_account_id_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.communication_provider_accounts(id) ON DELETE CASCADE;


--
-- Name: communication_conversations communication_conversations_assigned_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_conversations
    ADD CONSTRAINT communication_conversations_assigned_user_id_users_id_fk FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: communication_conversations communication_conversations_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_conversations
    ADD CONSTRAINT communication_conversations_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: communication_conversations communication_conversations_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_conversations
    ADD CONSTRAINT communication_conversations_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_messages communication_messages_account_id_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_account_id_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.communication_provider_accounts(id) ON DELETE CASCADE;


--
-- Name: communication_messages communication_messages_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: communication_messages communication_messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.communication_conversations(id) ON DELETE CASCADE;


--
-- Name: communication_messages communication_messages_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_outbox communication_outbox_message_id_messages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_outbox
    ADD CONSTRAINT communication_outbox_message_id_messages_id_fk FOREIGN KEY (message_id) REFERENCES public.communication_messages(id) ON DELETE CASCADE;


--
-- Name: communication_outbox communication_outbox_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_outbox
    ADD CONSTRAINT communication_outbox_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_provider_accounts communication_provider_accounts_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_provider_accounts
    ADD CONSTRAINT communication_provider_accounts_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_provider_secrets communication_provider_secrets_account_id_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_provider_secrets
    ADD CONSTRAINT communication_provider_secrets_account_id_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.communication_provider_accounts(id) ON DELETE CASCADE;


--
-- Name: communication_provider_secrets communication_provider_secrets_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_provider_secrets
    ADD CONSTRAINT communication_provider_secrets_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_user_state communication_user_state_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_user_state
    ADD CONSTRAINT communication_user_state_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.communication_conversations(id) ON DELETE CASCADE;


--
-- Name: communication_user_state communication_user_state_last_read_message_id_messages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_user_state
    ADD CONSTRAINT communication_user_state_last_read_message_id_messages_id_fk FOREIGN KEY (last_read_message_id) REFERENCES public.communication_messages(id) ON DELETE SET NULL;


--
-- Name: communication_user_state communication_user_state_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_user_state
    ADD CONSTRAINT communication_user_state_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: communication_user_state communication_user_state_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_user_state
    ADD CONSTRAINT communication_user_state_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: communication_webhook_events communication_webhook_events_account_id_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_webhook_events
    ADD CONSTRAINT communication_webhook_events_account_id_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.communication_provider_accounts(id) ON DELETE CASCADE;


--
-- Name: communication_webhook_events communication_webhook_events_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_webhook_events
    ADD CONSTRAINT communication_webhook_events_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: consent_templates consent_templates_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_app_messages customer_app_messages_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_app_messages
    ADD CONSTRAINT customer_app_messages_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_app_messages customer_app_messages_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_app_messages
    ADD CONSTRAINT customer_app_messages_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_consents customer_consents_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_consents
    ADD CONSTRAINT customer_consents_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: customer_consents customer_consents_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_consents
    ADD CONSTRAINT customer_consents_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_consents customer_consents_revoked_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_consents
    ADD CONSTRAINT customer_consents_revoked_by_user_id_users_id_fk FOREIGN KEY (revoked_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_consents customer_consents_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_consents
    ADD CONSTRAINT customer_consents_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_consents customer_consents_template_id_consent_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_consents
    ADD CONSTRAINT customer_consents_template_id_consent_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.consent_templates(id) ON DELETE RESTRICT;


--
-- Name: customer_credentials customer_credentials_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_credentials customer_credentials_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_package_item_balances customer_package_item_balances_customer_package_id_customer_ser; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_package_item_balances
    ADD CONSTRAINT customer_package_item_balances_customer_package_id_customer_ser FOREIGN KEY (customer_package_id) REFERENCES public.customer_service_packages(id) ON DELETE CASCADE;


--
-- Name: customer_package_item_balances customer_package_item_balances_package_item_id_service_package_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_package_item_balances
    ADD CONSTRAINT customer_package_item_balances_package_item_id_service_package_ FOREIGN KEY (package_item_id) REFERENCES public.service_package_items(id) ON DELETE RESTRICT;


--
-- Name: customer_package_item_balances customer_package_item_balances_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_package_item_balances
    ADD CONSTRAINT customer_package_item_balances_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_password_reset_tokens customer_password_reset_tokens_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_password_reset_tokens
    ADD CONSTRAINT customer_password_reset_tokens_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_password_reset_tokens customer_password_reset_tokens_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_password_reset_tokens
    ADD CONSTRAINT customer_password_reset_tokens_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_push_subscriptions customer_push_subscriptions_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_subscriptions
    ADD CONSTRAINT customer_push_subscriptions_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_push_subscriptions customer_push_subscriptions_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_subscriptions
    ADD CONSTRAINT customer_push_subscriptions_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_service_packages customer_service_packages_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_packages
    ADD CONSTRAINT customer_service_packages_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_service_packages customer_service_packages_package_id_service_packages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_packages
    ADD CONSTRAINT customer_service_packages_package_id_service_packages_id_fk FOREIGN KEY (package_id) REFERENCES public.service_packages(id) ON DELETE RESTRICT;


--
-- Name: customer_service_packages customer_service_packages_purchase_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_packages
    ADD CONSTRAINT customer_service_packages_purchase_sale_id_sales_id_fk FOREIGN KEY (purchase_sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: customer_service_packages customer_service_packages_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_packages
    ADD CONSTRAINT customer_service_packages_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_sessions customer_sessions_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_sessions customer_sessions_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customer_tags customer_tags_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT customer_tags_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: customers customers_merged_into_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_merged_into_customer_id_customers_id_fk FOREIGN KEY (merged_into_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: customers customers_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: data_exchange_settings data_exchange_settings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_exchange_settings
    ADD CONSTRAINT data_exchange_settings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: integration_settings integration_settings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_settings
    ADD CONSTRAINT integration_settings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_assets inventory_assets_cash_movement_id_cash_movements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_cash_movement_id_cash_movements_id_fk FOREIGN KEY (cash_movement_id) REFERENCES public.cash_movements(id) ON DELETE SET NULL;


--
-- Name: inventory_assets inventory_assets_cash_movement_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_cash_movement_salon_id_fk FOREIGN KEY (cash_movement_id, salon_id) REFERENCES public.cash_movements(id, salon_id);


--
-- Name: inventory_assets inventory_assets_disposed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_disposed_by_user_id_users_id_fk FOREIGN KEY (disposed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_assets inventory_assets_document_id_inventory_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;


--
-- Name: inventory_assets inventory_assets_document_line_id_inventory_document_lines_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_document_line_id_inventory_document_lines_id_f FOREIGN KEY (document_line_id) REFERENCES public.inventory_document_lines(id) ON DELETE SET NULL;


--
-- Name: inventory_assets inventory_assets_document_line_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_document_line_salon_id_fk FOREIGN KEY (document_line_id, salon_id) REFERENCES public.inventory_document_lines(id, salon_id);


--
-- Name: inventory_assets inventory_assets_document_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES public.inventory_documents(id, salon_id) ON DELETE RESTRICT;


--
-- Name: inventory_assets inventory_assets_reversal_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_reversal_salon_id_fk FOREIGN KEY (reverses_asset_id, salon_id) REFERENCES public.inventory_assets(id, salon_id);


--
-- Name: inventory_assets inventory_assets_reverses_asset_id_inventory_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_reverses_asset_id_inventory_assets_id_fk FOREIGN KEY (reverses_asset_id) REFERENCES public.inventory_assets(id) ON DELETE SET NULL;


--
-- Name: inventory_assets inventory_assets_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_assets inventory_assets_supplier_id_inventory_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_assets inventory_assets_supplier_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_assets
    ADD CONSTRAINT inventory_assets_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES public.inventory_suppliers(id, salon_id);


--
-- Name: inventory_count_lines inventory_count_lines_count_id_inventory_counts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_lines
    ADD CONSTRAINT inventory_count_lines_count_id_inventory_counts_id_fk FOREIGN KEY (count_id) REFERENCES public.inventory_counts(id) ON DELETE RESTRICT;


--
-- Name: inventory_count_lines inventory_count_lines_count_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_lines
    ADD CONSTRAINT inventory_count_lines_count_salon_id_fk FOREIGN KEY (count_id, salon_id) REFERENCES public.inventory_counts(id, salon_id) ON DELETE RESTRICT;


--
-- Name: inventory_count_lines inventory_count_lines_product_id_inventory_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_lines
    ADD CONSTRAINT inventory_count_lines_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES public.inventory_products(id) ON DELETE RESTRICT;


--
-- Name: inventory_count_lines inventory_count_lines_product_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_lines
    ADD CONSTRAINT inventory_count_lines_product_salon_id_fk FOREIGN KEY (product_id, salon_id) REFERENCES public.inventory_products(id, salon_id);


--
-- Name: inventory_count_lines inventory_count_lines_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_lines
    ADD CONSTRAINT inventory_count_lines_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_counts inventory_counts_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_counts inventory_counts_document_id_inventory_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.inventory_documents(id) ON DELETE SET NULL;


--
-- Name: inventory_counts inventory_counts_document_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES public.inventory_documents(id, salon_id);


--
-- Name: inventory_counts inventory_counts_posted_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_posted_by_user_id_users_id_fk FOREIGN KEY (posted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_counts inventory_counts_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_document_lines inventory_document_lines_document_id_inventory_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;


--
-- Name: inventory_document_lines inventory_document_lines_document_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES public.inventory_documents(id, salon_id) ON DELETE RESTRICT;


--
-- Name: inventory_document_lines inventory_document_lines_product_id_inventory_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES public.inventory_products(id) ON DELETE SET NULL;


--
-- Name: inventory_document_lines inventory_document_lines_product_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_product_salon_id_fk FOREIGN KEY (product_id, salon_id) REFERENCES public.inventory_products(id, salon_id);


--
-- Name: inventory_document_lines inventory_document_lines_reversal_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_reversal_salon_id_fk FOREIGN KEY (reverses_document_line_id, salon_id) REFERENCES public.inventory_document_lines(id, salon_id);


--
-- Name: inventory_document_lines inventory_document_lines_reverses_document_line_id_inventory_do; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_reverses_document_line_id_inventory_do FOREIGN KEY (reverses_document_line_id) REFERENCES public.inventory_document_lines(id) ON DELETE SET NULL;


--
-- Name: inventory_document_lines inventory_document_lines_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_document_lines inventory_document_lines_supplier_id_inventory_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_document_lines inventory_document_lines_supplier_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_document_lines
    ADD CONSTRAINT inventory_document_lines_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES public.inventory_suppliers(id, salon_id);


--
-- Name: inventory_documents inventory_documents_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_documents inventory_documents_posted_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_posted_by_user_id_users_id_fk FOREIGN KEY (posted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_documents inventory_documents_reversal_of_document_id_inventory_documents; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_reversal_of_document_id_inventory_documents FOREIGN KEY (reversal_of_document_id) REFERENCES public.inventory_documents(id) ON DELETE SET NULL;


--
-- Name: inventory_documents inventory_documents_reversal_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_reversal_salon_id_fk FOREIGN KEY (reversal_of_document_id, salon_id) REFERENCES public.inventory_documents(id, salon_id);


--
-- Name: inventory_documents inventory_documents_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_documents inventory_documents_supplier_id_inventory_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_documents inventory_documents_supplier_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_documents
    ADD CONSTRAINT inventory_documents_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES public.inventory_suppliers(id, salon_id);


--
-- Name: inventory_expenses inventory_expenses_cash_movement_id_cash_movements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_cash_movement_id_cash_movements_id_fk FOREIGN KEY (cash_movement_id) REFERENCES public.cash_movements(id) ON DELETE SET NULL;


--
-- Name: inventory_expenses inventory_expenses_cash_movement_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_cash_movement_salon_id_fk FOREIGN KEY (cash_movement_id, salon_id) REFERENCES public.cash_movements(id, salon_id);


--
-- Name: inventory_expenses inventory_expenses_document_id_inventory_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;


--
-- Name: inventory_expenses inventory_expenses_document_line_id_inventory_document_lines_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_document_line_id_inventory_document_lines_id FOREIGN KEY (document_line_id) REFERENCES public.inventory_document_lines(id) ON DELETE SET NULL;


--
-- Name: inventory_expenses inventory_expenses_document_line_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_document_line_salon_id_fk FOREIGN KEY (document_line_id, salon_id) REFERENCES public.inventory_document_lines(id, salon_id);


--
-- Name: inventory_expenses inventory_expenses_document_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES public.inventory_documents(id, salon_id) ON DELETE RESTRICT;


--
-- Name: inventory_expenses inventory_expenses_reversal_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_reversal_salon_id_fk FOREIGN KEY (reverses_expense_id, salon_id) REFERENCES public.inventory_expenses(id, salon_id);


--
-- Name: inventory_expenses inventory_expenses_reverses_expense_id_inventory_expenses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_reverses_expense_id_inventory_expenses_id_fk FOREIGN KEY (reverses_expense_id) REFERENCES public.inventory_expenses(id) ON DELETE SET NULL;


--
-- Name: inventory_expenses inventory_expenses_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_expenses inventory_expenses_supplier_id_inventory_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_supplier_id_inventory_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_expenses inventory_expenses_supplier_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_expenses
    ADD CONSTRAINT inventory_expenses_supplier_salon_id_fk FOREIGN KEY (supplier_id, salon_id) REFERENCES public.inventory_suppliers(id, salon_id);


--
-- Name: inventory_movements inventory_movements_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_document_id_inventory_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_document_id_inventory_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.inventory_documents(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_document_line_id_inventory_document_lines_i; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_document_line_id_inventory_document_lines_i FOREIGN KEY (document_line_id) REFERENCES public.inventory_document_lines(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_document_line_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_document_line_salon_id_fk FOREIGN KEY (document_line_id, salon_id) REFERENCES public.inventory_document_lines(id, salon_id);


--
-- Name: inventory_movements inventory_movements_document_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_document_salon_id_fk FOREIGN KEY (document_id, salon_id) REFERENCES public.inventory_documents(id, salon_id);


--
-- Name: inventory_movements inventory_movements_product_id_inventory_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES public.inventory_products(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_product_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_salon_id_fk FOREIGN KEY (product_id, salon_id) REFERENCES public.inventory_products(id, salon_id);


--
-- Name: inventory_movements inventory_movements_reversal_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_reversal_salon_id_fk FOREIGN KEY (reverses_movement_id, salon_id) REFERENCES public.inventory_movements(id, salon_id);


--
-- Name: inventory_movements inventory_movements_reverses_movement_id_inventory_movements_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_reverses_movement_id_inventory_movements_id FOREIGN KEY (reverses_movement_id) REFERENCES public.inventory_movements(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_products inventory_products_preferred_supplier_id_inventory_suppliers_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_products
    ADD CONSTRAINT inventory_products_preferred_supplier_id_inventory_suppliers_id FOREIGN KEY (preferred_supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_products inventory_products_preferred_supplier_salon_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_products
    ADD CONSTRAINT inventory_products_preferred_supplier_salon_id_fk FOREIGN KEY (preferred_supplier_id, salon_id) REFERENCES public.inventory_suppliers(id, salon_id);


--
-- Name: inventory_products inventory_products_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_products
    ADD CONSTRAINT inventory_products_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_reorder_requests inventory_reorder_requests_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reorder_requests
    ADD CONSTRAINT inventory_reorder_requests_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_reorder_requests inventory_reorder_requests_product_id_inventory_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reorder_requests
    ADD CONSTRAINT inventory_reorder_requests_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES public.inventory_products(id) ON DELETE CASCADE;


--
-- Name: inventory_reorder_requests inventory_reorder_requests_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reorder_requests
    ADD CONSTRAINT inventory_reorder_requests_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: inventory_suppliers inventory_suppliers_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: login_activity login_activity_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_activity
    ADD CONSTRAINT login_activity_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: login_activity login_activity_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_activity
    ADD CONSTRAINT login_activity_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_adjustment_reasons loyalty_adjustment_reasons_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_adjustment_reasons
    ADD CONSTRAINT loyalty_adjustment_reasons_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: loyalty_earning_rules loyalty_earning_rules_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_earning_rules
    ADD CONSTRAINT loyalty_earning_rules_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_adjustment_reason_id_loyalty_adjustment_reasons_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_adjustment_reason_id_loyalty_adjustment_reasons_ FOREIGN KEY (adjustment_reason_id) REFERENCES public.loyalty_adjustment_reasons(id) ON DELETE SET NULL;


--
-- Name: loyalty_points loyalty_points_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: loyalty_points loyalty_points_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_points loyalty_points_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: loyalty_points loyalty_points_redemption_id_loyalty_reward_redemptions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_redemption_id_loyalty_reward_redemptions_id_fk FOREIGN KEY (redemption_id) REFERENCES public.loyalty_reward_redemptions(id) ON DELETE SET NULL;


--
-- Name: loyalty_points loyalty_points_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: loyalty_points loyalty_points_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_applied_product_id_inventory_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_applied_product_id_inventory_product FOREIGN KEY (applied_product_id) REFERENCES public.inventory_products(id) ON DELETE SET NULL;


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_applied_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_applied_service_id_services_id_fk FOREIGN KEY (applied_service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_approved_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_approved_by_user_id_users_id_fk FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_reward_id_loyalty_rewards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_reward_id_loyalty_rewards_id_fk FOREIGN KEY (reward_id) REFERENCES public.loyalty_rewards(id) ON DELETE RESTRICT;


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: loyalty_reward_redemptions loyalty_reward_redemptions_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_reward_redemptions
    ADD CONSTRAINT loyalty_reward_redemptions_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: loyalty_rewards loyalty_rewards_product_id_inventory_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES public.inventory_products(id) ON DELETE SET NULL;


--
-- Name: loyalty_rewards loyalty_rewards_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: loyalty_rewards loyalty_rewards_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: loyalty_settings loyalty_settings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_settings
    ADD CONSTRAINT loyalty_settings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: loyalty_tiers loyalty_tiers_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_tiers
    ADD CONSTRAINT loyalty_tiers_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_approved_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_approved_by_user_id_users_id_fk FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketing_campaigns marketing_campaigns_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_template_id_campaign_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_template_id_campaign_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.campaign_templates(id) ON DELETE SET NULL;


--
-- Name: notification_preferences notification_preferences_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: platform_admin_sessions platform_admin_sessions_admin_id_platform_admins_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_sessions
    ADD CONSTRAINT platform_admin_sessions_admin_id_platform_admins_id_fk FOREIGN KEY (admin_id) REFERENCES public.platform_admins(id) ON DELETE CASCADE;


--
-- Name: platform_audit_log platform_audit_log_actor_admin_id_platform_admins_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_log
    ADD CONSTRAINT platform_audit_log_actor_admin_id_platform_admins_id_fk FOREIGN KEY (actor_admin_id) REFERENCES public.platform_admins(id) ON DELETE SET NULL;


--
-- Name: platform_audit_log platform_audit_log_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_log
    ADD CONSTRAINT platform_audit_log_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE SET NULL;


--
-- Name: platform_impersonation_sessions platform_impersonation_sessions_admin_id_platform_admins_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_impersonation_sessions
    ADD CONSTRAINT platform_impersonation_sessions_admin_id_platform_admins_id_fk FOREIGN KEY (admin_id) REFERENCES public.platform_admins(id) ON DELETE CASCADE;


--
-- Name: platform_impersonation_sessions platform_impersonation_sessions_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_impersonation_sessions
    ADD CONSTRAINT platform_impersonation_sessions_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: platform_impersonation_sessions platform_impersonation_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_impersonation_sessions
    ADD CONSTRAINT platform_impersonation_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_voucher_movements purchase_voucher_movements_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_voucher_movements
    ADD CONSTRAINT purchase_voucher_movements_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_voucher_movements purchase_voucher_movements_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_voucher_movements
    ADD CONSTRAINT purchase_voucher_movements_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: purchase_voucher_movements purchase_voucher_movements_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_voucher_movements
    ADD CONSTRAINT purchase_voucher_movements_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: purchase_voucher_movements purchase_voucher_movements_voucher_id_purchase_vouchers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_voucher_movements
    ADD CONSTRAINT purchase_voucher_movements_voucher_id_purchase_vouchers_id_fk FOREIGN KEY (voucher_id) REFERENCES public.purchase_vouchers(id) ON DELETE CASCADE;


--
-- Name: purchase_vouchers purchase_vouchers_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_vouchers
    ADD CONSTRAINT purchase_vouchers_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: purchase_vouchers purchase_vouchers_issued_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_vouchers
    ADD CONSTRAINT purchase_vouchers_issued_by_user_id_users_id_fk FOREIGN KEY (issued_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_vouchers purchase_vouchers_issued_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_vouchers
    ADD CONSTRAINT purchase_vouchers_issued_sale_id_sales_id_fk FOREIGN KEY (issued_sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: purchase_vouchers purchase_vouchers_purchaser_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_vouchers
    ADD CONSTRAINT purchase_vouchers_purchaser_customer_id_customers_id_fk FOREIGN KEY (purchaser_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: purchase_vouchers purchase_vouchers_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_vouchers
    ADD CONSTRAINT purchase_vouchers_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: purchase_vouchers purchase_vouchers_source_reward_redemption_id_loyalty_reward_re; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_vouchers
    ADD CONSTRAINT purchase_vouchers_source_reward_redemption_id_loyalty_reward_re FOREIGN KEY (source_reward_redemption_id) REFERENCES public.loyalty_reward_redemptions(id) ON DELETE SET NULL;


--
-- Name: pwa_branding_settings pwa_branding_settings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pwa_branding_settings
    ADD CONSTRAINT pwa_branding_settings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: reminder_settings reminder_settings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_settings
    ADD CONSTRAINT reminder_settings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: review_invitation_deliveries review_invitation_deliveries_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_invitation_deliveries
    ADD CONSTRAINT review_invitation_deliveries_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.review_invitations(id) ON DELETE CASCADE;


--
-- Name: review_invitation_deliveries review_invitation_deliveries_salon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_invitation_deliveries
    ADD CONSTRAINT review_invitation_deliveries_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: review_invitations review_invitations_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_invitations
    ADD CONSTRAINT review_invitations_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: review_invitations review_invitations_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_invitations
    ADD CONSTRAINT review_invitations_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: review_request_settings review_request_settings_salon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_request_settings
    ADD CONSTRAINT review_request_settings_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: review_request_settings review_request_settings_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_request_settings
    ADD CONSTRAINT review_request_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: reviews reviews_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_product_id_inventory_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES public.inventory_products(id) ON DELETE SET NULL;


--
-- Name: sale_items sale_items_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: sale_items sale_items_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: sale_payments sale_payments_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_payments sale_payments_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: sale_payments sale_payments_voucher_id_purchase_vouchers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_voucher_id_purchase_vouchers_id_fk FOREIGN KEY (voucher_id) REFERENCES public.purchase_vouchers(id) ON DELETE SET NULL;


--
-- Name: sales sales_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: sales sales_closed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_closed_by_user_id_users_id_fk FOREIGN KEY (closed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales sales_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: sales sales_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: sales sales_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: sales sales_voided_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_voided_by_user_id_users_id_fk FOREIGN KEY (voided_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: salon_closures salon_closures_salon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_closures
    ADD CONSTRAINT salon_closures_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: salon_locations salon_locations_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_locations
    ADD CONSTRAINT salon_locations_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: salon_modules salon_modules_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_modules
    ADD CONSTRAINT salon_modules_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: salon_resources salon_resources_location_id_salon_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_resources
    ADD CONSTRAINT salon_resources_location_id_salon_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.salon_locations(id) ON DELETE SET NULL;


--
-- Name: salon_resources salon_resources_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_resources
    ADD CONSTRAINT salon_resources_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: salon_settings salon_settings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_settings
    ADD CONSTRAINT salon_settings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: salon_settings salon_settings_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_settings
    ADD CONSTRAINT salon_settings_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: salon_special_opening_staff salon_special_opening_staff_special_opening_id_salon_special_op; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_special_opening_staff
    ADD CONSTRAINT salon_special_opening_staff_special_opening_id_salon_special_op FOREIGN KEY (special_opening_id) REFERENCES public.salon_special_openings(id) ON DELETE CASCADE;


--
-- Name: salon_special_opening_staff salon_special_opening_staff_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_special_opening_staff
    ADD CONSTRAINT salon_special_opening_staff_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: salon_special_openings salon_special_openings_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_special_openings
    ADD CONSTRAINT salon_special_openings_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: saved_views saved_views_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: saved_views saved_views_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_categories service_categories_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: service_package_items service_package_items_package_id_service_packages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_package_id_service_packages_id_fk FOREIGN KEY (package_id) REFERENCES public.service_packages(id) ON DELETE CASCADE;


--
-- Name: service_package_items service_package_items_product_id_inventory_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_product_id_inventory_products_id_fk FOREIGN KEY (product_id) REFERENCES public.inventory_products(id) ON DELETE RESTRICT;


--
-- Name: service_package_items service_package_items_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: service_package_items service_package_items_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- Name: service_package_usages service_package_usages_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: service_package_usages service_package_usages_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: service_package_usages service_package_usages_customer_package_id_customer_service_pac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_customer_package_id_customer_service_pac FOREIGN KEY (customer_package_id) REFERENCES public.customer_service_packages(id) ON DELETE CASCADE;


--
-- Name: service_package_usages service_package_usages_package_item_id_service_package_items_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_package_item_id_service_package_items_id FOREIGN KEY (package_item_id) REFERENCES public.service_package_items(id) ON DELETE RESTRICT;


--
-- Name: service_package_usages service_package_usages_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: service_package_usages service_package_usages_sale_item_id_sale_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_sale_item_id_sale_items_id_fk FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id) ON DELETE SET NULL;


--
-- Name: service_package_usages service_package_usages_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_usages
    ADD CONSTRAINT service_package_usages_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: service_packages service_packages_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: service_packages service_packages_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: service_resources service_resources_resource_id_salon_resources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_resources
    ADD CONSTRAINT service_resources_resource_id_salon_resources_id_fk FOREIGN KEY (resource_id) REFERENCES public.salon_resources(id) ON DELETE CASCADE;


--
-- Name: service_resources service_resources_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_resources
    ADD CONSTRAINT service_resources_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: service_resources service_resources_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_resources
    ADD CONSTRAINT service_resources_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_staff service_staff_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: service_staff service_staff_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_staff service_staff_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: services services_category_id_service_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_service_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL;


--
-- Name: services services_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: staff_availability_requests staff_availability_requests_reviewed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_availability_requests
    ADD CONSTRAINT staff_availability_requests_reviewed_by_user_id_users_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff_availability_requests staff_availability_requests_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_availability_requests
    ADD CONSTRAINT staff_availability_requests_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: staff_availability_requests staff_availability_requests_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_availability_requests
    ADD CONSTRAINT staff_availability_requests_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff staff_location_id_salon_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_location_id_salon_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.salon_locations(id) ON DELETE SET NULL;


--
-- Name: staff staff_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: staff staff_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_credentials user_credentials_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_interface_preferences user_interface_preferences_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_interface_preferences
    ADD CONSTRAINT user_interface_preferences_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: user_interface_preferences user_interface_preferences_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_interface_preferences
    ADD CONSTRAINT user_interface_preferences_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: waitlist_entries waitlist_entries_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entries
    ADD CONSTRAINT waitlist_entries_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: waitlist_entries waitlist_entries_salon_id_salons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entries
    ADD CONSTRAINT waitlist_entries_salon_id_salons_id_fk FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE;


--
-- Name: waitlist_entries waitlist_entries_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entries
    ADD CONSTRAINT waitlist_entries_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: waitlist_entries waitlist_entries_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entries
    ADD CONSTRAINT waitlist_entries_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- PostgreSQL database dump complete
--

\unrestrict nZFnzooDF142od9uYh5q1zmDrWccnjheatKxSvIcA1BflkXwLFF7QLi4ohPA29n

