import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  activityLog,
  appointmentNotes,
  consentTemplates,
  customerPackageItemBalances,
  customerConsents,
  customerServicePackages,
  customers,
  inventoryProducts,
  servicePackageItems,
  servicePackageUsages,
  servicePackages,
  services,
  staffAvailabilityRequests,
  users,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import {
  archiveConsentTemplate,
  ConsentLifecycleError,
  createConsentRequest,
  createConsentTemplate,
  createDrizzleConsentRepository,
  expireDueConsentRequests,
  renderConsentEvidence,
  resendConsentRequest,
  resolveConsent,
  revokeConsent,
  signConsent,
  versionTemplate,
  type ConsentDeliveryChannel,
  type ConsentLifecycleRepository,
  type ConsentRequestRecord,
} from "../../lib/consent-evidence.js";
import { parseBody, type SafeParseSchema } from "../../lib/http-validation.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deliveryChannels = new Set<ConsentDeliveryChannel>(["email", "in_person", "sms"]);
const templateTypes = new Set(["anamnesis", "photo_release", "privacy", "treatment"]);

function invalid(fields: Record<string, string[]>) {
  return { error: { fieldErrors: fields }, success: false as const };
}

function bodyRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function boundedText(value: unknown, minimum: number, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length >= minimum && text.length <= maximum ? text : undefined;
}

function serviceIds(value: unknown, fields: Record<string, string[]>): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((item) => !validUuid(item))
  ) {
    fields.required_for_services = ["Servizi richiesti non validi"];
    return [];
  }
  return [...new Set(value)];
}

interface TemplateBody {
  active?: boolean;
  body: string;
  name: string;
  required_for_services: string[];
  type: string;
}

const templateBodySchema: SafeParseSchema<TemplateBody> = {
  safeParse(value) {
    const body = bodyRecord(value);
    if (!body) return invalid({ body: ["Corpo della richiesta non valido"] });
    const fields: Record<string, string[]> = {};
    const name = boundedText(body.name, 1, 160);
    const documentBody = boundedText(body.body, 1, 100_000);
    const type = typeof body.type === "string" && templateTypes.has(body.type) ? body.type : undefined;
    if (!name) fields.name = ["Nome del modello obbligatorio"];
    if (!documentBody) fields.body = ["Testo del modello obbligatorio"];
    if (!type) fields.type = ["Tipo di modello non valido"];
    if (body.active !== undefined && typeof body.active !== "boolean") {
      fields.active = ["Stato del modello non valido"];
    }
    const requiredForServices = serviceIds(body.required_for_services, fields);
    return Object.keys(fields).length > 0
      ? invalid(fields)
      : {
          data: {
            active: body.active as boolean | undefined,
            body: documentBody!,
            name: name!,
            required_for_services: requiredForServices,
            type: type!,
          },
          success: true as const,
        };
  },
};

interface VersionTemplateBody {
  active?: boolean;
  body: string;
  name?: string;
  required_for_services?: string[];
  type?: string;
}

const versionTemplateBodySchema: SafeParseSchema<VersionTemplateBody> = {
  safeParse(value) {
    const body = bodyRecord(value);
    if (!body) return invalid({ body: ["Corpo della richiesta non valido"] });
    const fields: Record<string, string[]> = {};
    const documentBody = boundedText(body.body, 1, 100_000);
    const name = body.name === undefined ? undefined : boundedText(body.name, 1, 160);
    const type = body.type === undefined
      ? undefined
      : typeof body.type === "string" && templateTypes.has(body.type) ? body.type : null;
    if (!documentBody) fields.body = ["Testo del modello obbligatorio"];
    if (body.name !== undefined && !name) fields.name = ["Nome del modello non valido"];
    if (type === null) fields.type = ["Tipo di modello non valido"];
    if (body.active !== undefined && typeof body.active !== "boolean") {
      fields.active = ["Stato del modello non valido"];
    }
    const requiredForServices = body.required_for_services === undefined
      ? undefined
      : serviceIds(body.required_for_services, fields);
    return Object.keys(fields).length > 0
      ? invalid(fields)
      : {
          data: {
            active: body.active as boolean | undefined,
            body: documentBody!,
            name,
            required_for_services: requiredForServices,
            type: type ?? undefined,
          },
          success: true as const,
        };
  },
};

interface CreateConsentRequestBody {
  appointment_id?: string;
  customer_id: string;
  delivery_channel: ConsentDeliveryChannel;
  expires_at: Date;
  template_id: string;
}

export const createConsentRequestBodySchema: SafeParseSchema<CreateConsentRequestBody> = {
  safeParse(value) {
    const body = bodyRecord(value);
    if (!body) return invalid({ body: ["Corpo della richiesta non valido"] });
    const fields: Record<string, string[]> = {};
    const appointmentId = body.appointment_id === undefined ? undefined : body.appointment_id;
    if (!validUuid(body.customer_id)) fields.customer_id = ["Cliente non valido"];
    if (!validUuid(body.template_id)) fields.template_id = ["Modello non valido"];
    if (appointmentId !== undefined && !validUuid(appointmentId)) {
      fields.appointment_id = ["Appuntamento non valido"];
    }
    const deliveryChannel = body.delivery_channel ?? "in_person";
    if (typeof deliveryChannel !== "string" || !deliveryChannels.has(deliveryChannel as ConsentDeliveryChannel)) {
      fields.delivery_channel = ["Canale di consegna non valido"];
    }
    const expiresAt = body.expires_at === undefined
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000)
      : new Date(typeof body.expires_at === "string" ? body.expires_at : Number.NaN);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      fields.expires_at = ["Scadenza non valida"];
    }
    return Object.keys(fields).length > 0
      ? invalid(fields)
      : {
          data: {
            appointment_id: appointmentId as string | undefined,
            customer_id: body.customer_id as string,
            delivery_channel: deliveryChannel as ConsentDeliveryChannel,
            expires_at: expiresAt,
            template_id: body.template_id as string,
          },
          success: true as const,
        };
  },
};

interface ResendConsentBody {
  delivery_channel: ConsentDeliveryChannel;
  expires_at: Date;
}

const resendConsentBodySchema: SafeParseSchema<ResendConsentBody> = {
  safeParse(value) {
    const body = bodyRecord(value);
    if (!body) return invalid({ body: ["Corpo della richiesta non valido"] });
    const fields: Record<string, string[]> = {};
    const deliveryChannel = body.delivery_channel;
    if (typeof deliveryChannel !== "string" || !deliveryChannels.has(deliveryChannel as ConsentDeliveryChannel)) {
      fields.delivery_channel = ["Canale di consegna non valido"];
    }
    const expiresAt = new Date(typeof body.expires_at === "string" ? body.expires_at : Number.NaN);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      fields.expires_at = ["Scadenza non valida"];
    }
    return Object.keys(fields).length > 0
      ? invalid(fields)
      : {
          data: {
            delivery_channel: deliveryChannel as ConsentDeliveryChannel,
            expires_at: expiresAt,
          },
          success: true as const,
        };
  },
};

interface SignConsentBody {
  accepted: true;
  signature: { type: "drawn" | "typed"; value: string };
  signer_name: string;
}

const signConsentBodySchema: SafeParseSchema<SignConsentBody> = {
  safeParse(value) {
    const body = bodyRecord(value);
    if (!body) return invalid({ body: ["Corpo della richiesta non valido"] });
    const fields: Record<string, string[]> = {};
    if (body.accepted !== true) fields.accepted = ["Accettazione esplicita obbligatoria"];
    const signerName = boundedText(body.signer_name, 2, 160);
    if (!signerName) fields.signer_name = ["Nome del firmatario non valido"];
    const signature = bodyRecord(body.signature);
    const signatureType = signature?.type;
    const signatureLimit = signatureType === "drawn" ? 200_000 : 200;
    const signatureValue = boundedText(signature?.value, 1, signatureLimit);
    if ((signatureType !== "drawn" && signatureType !== "typed") || !signatureValue) {
      fields.signature = ["Firma non valida"];
    }
    return Object.keys(fields).length > 0
      ? invalid(fields)
      : {
          data: {
            accepted: true,
            signature: { type: signatureType as "drawn" | "typed", value: signatureValue! },
            signer_name: signerName!,
          },
          success: true as const,
        };
  },
};

interface RevokeConsentBody { reason: string }

const revokeConsentBodySchema: SafeParseSchema<RevokeConsentBody> = {
  safeParse(value) {
    const body = bodyRecord(value);
    if (!body) return invalid({ body: ["Corpo della richiesta non valido"] });
    const reason = boundedText(body.reason, 3, 1_000);
    return reason
      ? { data: { reason }, success: true as const }
      : invalid({ reason: ["Motivo della revoca obbligatorio"] });
  },
};

const emptyBodySchema: SafeParseSchema<Record<string, never>> = {
  safeParse(value) {
    const body = value === undefined ? {} : bodyRecord(value);
    return body && Object.keys(body).length === 0
      ? { data: {}, success: true as const }
      : invalid({ body: ["Il corpo deve essere vuoto"] });
  },
};

function consentDto(consent: ConsentRequestRecord) {
  return {
    appointment_id: consent.appointmentId,
    created_at: consent.createdAt.toISOString(),
    customer_id: consent.customerId,
    delivery_channel: consent.deliveryChannel,
    document_hash: consent.documentHash,
    expires_at: consent.expiresAt?.toISOString() ?? null,
    id: consent.id,
    revoked_at: consent.revokedAt?.toISOString() ?? null,
    revoked_by_user_id: consent.revokedByUserId,
    revocation_reason: consent.revocationReason,
    signed_at: consent.signedAt?.toISOString() ?? null,
    signer_name: consent.signerName,
    status: consent.status,
    template_id: consent.templateId,
  };
}

function sendConsentError(reply: FastifyReply, error: unknown) {
  if (error instanceof ConsentLifecycleError) {
    return reply.code(error.statusCode).send({ error: error.code });
  }
  throw error;
}

function ensureSalon(request: { params: { id: string }; salonId: string }, reply: { code(statusCode: number): { send(payload: unknown): unknown } }) {
  if (request.params.id !== request.salonId) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
  return undefined;
}

export async function registerEnterpriseModuleRoutes(
  app: FastifyInstance,
  options: { consentRepository?: ConsentLifecycleRepository } = {},
) {
  const consentRepository = options.consentRepository ?? createDrizzleConsentRepository(app.db);
  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/consent-templates",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      return app.db
        .select()
        .from(consentTemplates)
        .where(eq(consentTemplates.salonId, request.salonId))
        .orderBy(desc(consentTemplates.createdAt));
    },
  );

  app.post<{ Body: TemplateBody; Params: { id: string } }>(
    "/api/salons/:id/consent-templates",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const body = parseBody(templateBodySchema, request, reply);
      if (!body) return;
      try {
        const created = await createConsentTemplate(consentRepository, {
          active: body.active,
          body: body.body,
          name: body.name,
          requiredForServices: body.required_for_services,
          salonId: request.salonId,
          type: body.type,
        });
        return reply.code(201).send(created);
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/consent-template-options",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .select({
          id: consentTemplates.id,
          name: consentTemplates.name,
          requiredForServices: consentTemplates.requiredForServices,
          type: consentTemplates.type,
          version: consentTemplates.version,
        })
        .from(consentTemplates)
        .where(and(
          eq(consentTemplates.salonId, request.salonId),
          eq(consentTemplates.active, true),
        ))
        .orderBy(desc(consentTemplates.createdAt));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        required_for_services: row.requiredForServices,
        type: row.type,
        version: row.version,
      }));
    },
  );

  app.post<{
    Body: VersionTemplateBody;
    Params: { id: string; templateId: string };
  }>(
    "/api/salons/:id/consent-templates/:templateId/versions",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!validUuid(request.params.templateId)) {
        return reply.code(400).send({ error: "INVALID_REQUEST", fields: { template_id: ["Modello non valido"] } });
      }
      const body = parseBody(versionTemplateBodySchema, request, reply);
      if (!body) return;
      try {
        const created = await versionTemplate(consentRepository, request.params.templateId, {
          active: body.active,
          body: body.body,
          name: body.name,
          requiredForServices: body.required_for_services,
          salonId: request.salonId,
          type: body.type,
        });
        return reply.code(201).send(created);
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.patch<{
    Body: Record<string, never>;
    Params: { id: string; templateId: string };
  }>(
    "/api/salons/:id/consent-templates/:templateId/archive",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!validUuid(request.params.templateId)) {
        return reply.code(400).send({ error: "INVALID_REQUEST", fields: { template_id: ["Modello non valido"] } });
      }
      const body = parseBody(emptyBodySchema, request, reply);
      if (!body) return;
      try {
        return await archiveConsentTemplate(consentRepository, request.salonId, request.params.templateId);
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { customer_id?: string; appointment_id?: string } }>(
    "/api/salons/:id/customer-consents",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const filters = [eq(customerConsents.salonId, request.salonId)];
      if (request.query.customer_id) filters.push(eq(customerConsents.customerId, request.query.customer_id));
      if (request.query.appointment_id) filters.push(eq(customerConsents.appointmentId, request.query.appointment_id));
      await expireDueConsentRequests(consentRepository, request.salonId);
      const rows = await app.db
        .select({
          consent: customerConsents,
          templateName: consentTemplates.name,
          templateVersion: consentTemplates.version,
        })
        .from(customerConsents)
        .innerJoin(consentTemplates, eq(consentTemplates.id, customerConsents.templateId))
        .where(and(...filters))
        .orderBy(desc(customerConsents.createdAt));
      return rows.map((row) => ({
        ...consentDto(row.consent),
        template_name: row.templateName,
        template_version: row.templateVersion,
      }));
    },
  );

  app.post<{ Body: CreateConsentRequestBody; Params: { id: string } }>(
    "/api/salons/:id/customer-consents",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const body = parseBody(createConsentRequestBodySchema, request, reply);
      if (!body) return;
      try {
        const created = await createConsentRequest(consentRepository, {
          appointmentId: body.appointment_id,
          customerId: body.customer_id,
          deliveryChannel: body.delivery_channel,
          expiresAt: body.expires_at,
          salonId: request.salonId,
          templateId: body.template_id,
        });
        return reply.code(201).send({
          consent: consentDto(created.consent),
          signing_url: `/consents/${encodeURIComponent(created.rawToken)}`,
        });
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.post<{
    Body: ResendConsentBody;
    Params: { consentId: string; id: string };
  }>(
    "/api/salons/:id/customer-consents/:consentId/resend",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!validUuid(request.params.consentId)) {
        return reply.code(400).send({ error: "INVALID_REQUEST", fields: { consent_id: ["Richiesta non valida"] } });
      }
      const body = parseBody(resendConsentBodySchema, request, reply);
      if (!body) return;
      try {
        const resent = await resendConsentRequest(consentRepository, request.params.consentId, {
          deliveryChannel: body.delivery_channel,
          expiresAt: body.expires_at,
          salonId: request.salonId,
        });
        return {
          consent: consentDto(resent.consent),
          signing_url: `/consents/${encodeURIComponent(resent.rawToken)}`,
        };
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.post<{
    Body: SignConsentBody;
    Params: { consentId: string; id: string };
  }>(
    "/api/salons/:id/customer-consents/:consentId/sign",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!validUuid(request.params.consentId)) {
        return reply.code(400).send({ error: "INVALID_REQUEST", fields: { consent_id: ["Richiesta non valida"] } });
      }
      const body = parseBody(signConsentBodySchema, request, reply);
      if (!body) return;
      try {
        const signed = await signConsent(consentRepository, {
          consentId: request.params.consentId,
          salonId: request.salonId,
          signedByUserId: request.user.id,
        }, {
          accepted: body.accepted,
          signature: body.signature,
          signerName: body.signer_name,
        }, {
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });
        return consentDto(signed);
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.post<{
    Body: RevokeConsentBody;
    Params: { consentId: string; id: string };
  }>(
    "/api/salons/:id/customer-consents/:consentId/revoke",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!validUuid(request.params.consentId)) {
        return reply.code(400).send({ error: "INVALID_REQUEST", fields: { consent_id: ["Richiesta non valida"] } });
      }
      const body = parseBody(revokeConsentBodySchema, request, reply);
      if (!body) return;
      try {
        return consentDto(await revokeConsent(consentRepository, request.params.consentId, {
          reason: body.reason,
          revokedByUserId: request.user.id,
          salonId: request.salonId,
        }));
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.get<{ Params: { consentId: string; id: string } }>(
    "/api/salons/:id/customer-consents/:consentId/evidence",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!validUuid(request.params.consentId)) {
        return reply.code(400).send({ error: "INVALID_REQUEST", fields: { consent_id: ["Richiesta non valida"] } });
      }
      try {
        const evidence = await renderConsentEvidence(consentRepository, request.params.consentId, {
          salonId: request.salonId,
        });
        return reply
          .header("content-disposition", `attachment; filename="${evidence.filename}"`)
          .header("x-document-sha256", evidence.documentHash)
          .type(evidence.contentType)
          .send(evidence.content);
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.get<{ Params: { token: string } }>(
    "/api/public/consents/:token",
    async (request, reply) => {
      try {
        const consent = await resolveConsent(consentRepository, request.params.token);
        return {
          consent: {
            body: consent.templateBody,
            expires_at: consent.expiresAt?.toISOString() ?? null,
            id: consent.id,
            name: consent.templateName,
            status: consent.status,
            type: consent.templateType,
            version: consent.templateVersion,
          },
          salon: { name: consent.salonName },
        };
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.post<{ Body: SignConsentBody; Params: { token: string } }>(
    "/api/public/consents/:token/sign",
    async (request, reply) => {
      const body = parseBody(signConsentBodySchema, request, reply);
      if (!body) return;
      try {
        return consentDto(await signConsent(consentRepository, request.params.token, {
          accepted: body.accepted,
          signature: body.signature,
          signerName: body.signer_name,
        }, {
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        }));
      } catch (error) {
        return sendConsentError(reply, error);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/service-packages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const packages = await app.db.select().from(servicePackages).where(eq(servicePackages.salonId, request.salonId)).orderBy(desc(servicePackages.createdAt));
      const items = await app.db.select({
        id: servicePackageItems.id,
        itemType: servicePackageItems.itemType,
        name: sql<string>`coalesce(${services.name}, ${inventoryProducts.name})`,
        packageId: servicePackageItems.packageId,
        productId: servicePackageItems.productId,
        quantity: servicePackageItems.quantity,
        serviceId: servicePackageItems.serviceId,
      }).from(servicePackageItems)
        .leftJoin(services, eq(services.id, servicePackageItems.serviceId))
        .leftJoin(inventoryProducts, eq(inventoryProducts.id, servicePackageItems.productId))
        .where(eq(servicePackageItems.salonId, request.salonId));
      return packages.map((item) => ({ ...item, items: items.filter((entry) => entry.packageId === item.id) }));
    },
  );

  app.post<{
    Body: {
      active?: boolean;
      description?: string;
      items: Array<{ item_type: "product" | "service"; product_id?: string; quantity: number; service_id?: string }>;
      name: string;
      price_cents?: number;
      validity_days?: number;
    };
    Params: { id: string };
  }>(
    "/api/salons/:id/service-packages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!request.body.name?.trim() || !request.body.items?.length || request.body.items.some((item) =>
        item.quantity <= 0 ||
        (item.item_type === "service" ? !item.service_id : !item.product_id)
      )) {
        return reply.code(400).send({ error: "SERVICE_PACKAGE_REQUIRED" });
      }
      const packageItem = await app.db.transaction(async (tx) => {
        const rows = await tx.insert(servicePackages).values({
          active: request.body.active ?? true,
          description: request.body.description,
          includedSessions: request.body.items.reduce((sum, item) => sum + item.quantity, 0),
          name: request.body.name.trim(),
          priceCents: Math.max(0, Math.trunc(request.body.price_cents ?? 0)),
          salonId: request.salonId,
          validityDays: request.body.validity_days,
        }).returning();
        const created = rows[0]!;
        const items = await tx.insert(servicePackageItems).values(request.body.items.map((item) => ({
          itemType: item.item_type,
          packageId: created.id,
          productId: item.product_id,
          quantity: Math.trunc(item.quantity),
          salonId: request.salonId,
          serviceId: item.service_id,
        }))).returning();
        return { ...created, items };
      });
      return reply.code(201).send(packageItem);
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { customer_id: string };
  }>(
    "/api/salons/:id/customer-service-packages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const packages = await app.db.select({
        active: customerServicePackages.active,
        customerId: customerServicePackages.customerId,
        expiresAt: customerServicePackages.expiresAt,
        id: customerServicePackages.id,
        name: servicePackages.name,
        packageId: customerServicePackages.packageId,
        startsAt: customerServicePackages.startsAt,
      }).from(customerServicePackages)
        .innerJoin(servicePackages, eq(servicePackages.id, customerServicePackages.packageId))
        .where(and(
          eq(customerServicePackages.salonId, request.salonId),
          eq(customerServicePackages.customerId, request.query.customer_id),
          eq(customerServicePackages.active, true),
          sql`(${customerServicePackages.expiresAt} is null or ${customerServicePackages.expiresAt} > now())`,
        ));
      const balances = await app.db.select({
        customerPackageId: customerPackageItemBalances.customerPackageId,
        itemType: servicePackageItems.itemType,
        name: sql<string>`coalesce(${services.name}, ${inventoryProducts.name})`,
        packageItemId: customerPackageItemBalances.packageItemId,
        productId: servicePackageItems.productId,
        remainingQuantity: sql<number>`${customerPackageItemBalances.totalQuantity} - ${customerPackageItemBalances.usedQuantity}`,
        serviceId: servicePackageItems.serviceId,
        totalQuantity: customerPackageItemBalances.totalQuantity,
        usedQuantity: customerPackageItemBalances.usedQuantity,
      }).from(customerPackageItemBalances)
        .innerJoin(servicePackageItems, eq(servicePackageItems.id, customerPackageItemBalances.packageItemId))
        .leftJoin(services, eq(services.id, servicePackageItems.serviceId))
        .leftJoin(inventoryProducts, eq(inventoryProducts.id, servicePackageItems.productId))
        .where(eq(customerPackageItemBalances.salonId, request.salonId));
      return packages.map((item) => ({
        ...item,
        items: balances.filter((balance) => balance.customerPackageId === item.id),
      }));
    },
  );

  app.post<{
    Body: { customer_id: string; expires_at?: string; notes?: string; package_id: string; purchase_sale_id?: string };
    Params: { id: string };
  }>(
    "/api/salons/:id/customer-service-packages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const result = await app.db.transaction(async (tx) => {
        const customerRows = await tx.select({ id: customers.id }).from(customers).where(and(
          eq(customers.id, request.body.customer_id),
          eq(customers.salonId, request.salonId),
        ));
        const packageRows = await tx.select().from(servicePackages).where(and(
          eq(servicePackages.id, request.body.package_id),
          eq(servicePackages.salonId, request.salonId),
          eq(servicePackages.active, true),
        ));
        if (!customerRows[0] || !packageRows[0]) throw new Error("PACKAGE_ASSIGNMENT_INVALID");
        const packageItems = await tx.select().from(servicePackageItems).where(eq(servicePackageItems.packageId, request.body.package_id));
        if (!packageItems.length) throw new Error("PACKAGE_EMPTY");
        const rows = await tx.insert(customerServicePackages).values({
          customerId: request.body.customer_id,
          expiresAt: request.body.expires_at ? new Date(request.body.expires_at) : undefined,
          notes: request.body.notes,
          packageId: request.body.package_id,
          purchaseSaleId: request.body.purchase_sale_id,
          salonId: request.salonId,
          totalSessions: packageItems.reduce((sum, item) => sum + item.quantity, 0),
        }).returning();
        await tx.insert(customerPackageItemBalances).values(packageItems.map((item) => ({
          customerPackageId: rows[0]!.id,
          packageItemId: item.id,
          salonId: request.salonId,
          totalQuantity: item.quantity,
        })));
        return rows[0]!;
      }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "PACKAGE_ASSIGNMENT_FAILED" }));
      if ("error" in result) return reply.code(400).send(result);
      return reply.code(201).send(result);
    },
  );

  app.post<{
    Body: { appointment_id?: string; note?: string; package_item_id: string; quantity_used?: number };
    Params: { customerPackageId: string; id: string };
  }>(
    "/api/salons/:id/customer-service-packages/:customerPackageId/usages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const quantityUsed = Math.max(1, Math.trunc(request.body.quantity_used ?? 1));
      const result = await app.db.transaction(async (tx) => {
        const balanceRows = await tx.select({
          remaining: sql<number>`${customerPackageItemBalances.totalQuantity} - ${customerPackageItemBalances.usedQuantity}`,
        }).from(customerPackageItemBalances).where(and(
          eq(customerPackageItemBalances.customerPackageId, request.params.customerPackageId),
          eq(customerPackageItemBalances.packageItemId, request.body.package_item_id),
          eq(customerPackageItemBalances.salonId, request.salonId),
        )).for("update");
        if (!balanceRows[0] || balanceRows[0].remaining < quantityUsed) throw new Error("PACKAGE_BALANCE_INSUFFICIENT");
        const rows = await tx.insert(servicePackageUsages).values({
          appointmentId: request.body.appointment_id,
          createdByUserId: request.user.id,
          customerPackageId: request.params.customerPackageId,
          note: request.body.note,
          packageItemId: request.body.package_item_id,
          quantityUsed,
          salonId: request.salonId,
          sessionsUsed: quantityUsed,
        }).returning();
        await tx.update(customerPackageItemBalances).set({
          usedQuantity: sql`${customerPackageItemBalances.usedQuantity} + ${quantityUsed}`,
        }).where(and(
          eq(customerPackageItemBalances.customerPackageId, request.params.customerPackageId),
          eq(customerPackageItemBalances.packageItemId, request.body.package_item_id),
        ));
        await tx.update(customerServicePackages).set({
          usedSessions: sql`${customerServicePackages.usedSessions} + ${quantityUsed}`,
        }).where(eq(customerServicePackages.id, request.params.customerPackageId));
        return rows[0]!;
      }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "PACKAGE_USAGE_FAILED" }));
      if ("error" in result) return reply.code(400).send(result);
      return reply.code(201).send(result);
    },
  );

  app.post<{
    Body: { ends_at: string; reason?: string; starts_at: string };
    Params: { id: string; staffId: string };
  }>(
    "/api/salons/:id/staff/:staffId/availability-requests",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(staffAvailabilityRequests)
        .values({
          endsAt: new Date(request.body.ends_at),
          reason: request.body.reason,
          salonId: request.salonId,
          staffId: request.params.staffId,
          startsAt: new Date(request.body.starts_at),
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/audit-log",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_USERS),
        requireModule(MODULE_KEYS.AUDIT_COMPLIANCE),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      return app.db
        .select({
          action: activityLog.action,
          actorAvatarUrl: users.avatarUrl,
          actorName: users.fullName,
          actorRole: users.role,
          actorUserId: activityLog.actorUserId,
          createdAt: activityLog.createdAt,
          diff: activityLog.diff,
          entityId: activityLog.entityId,
          entityType: activityLog.entityType,
          id: activityLog.id,
          payload: activityLog.payload,
          summary: activityLog.summary,
        })
        .from(activityLog)
        .leftJoin(users, eq(users.id, activityLog.actorUserId))
        .where(eq(activityLog.salonId, request.salonId))
        .orderBy(desc(activityLog.createdAt))
        .limit(200);
    },
  );

  app.post<{
    Body: { appointment_id: string; body: string };
    Params: { id: string };
  }>(
    "/api/salons/:id/appointment-private-notes",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(appointmentNotes)
        .values({
          appointmentId: request.body.appointment_id,
          authorUserId: request.user.id,
          body: request.body.body,
          salonId: request.salonId,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );
}
