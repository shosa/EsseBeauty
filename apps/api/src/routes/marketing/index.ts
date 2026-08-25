import { randomUUID } from "node:crypto";

import type {
  FastifyInstance,
  FastifyReply,
  preHandlerHookHandler,
} from "fastify";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";

import {
  appointments,
  campaignRecipients,
  campaignTemplates,
  communicationConsents,
  communicationProviderAccounts,
  customers,
  loyaltyPoints,
  marketingCampaigns,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { aggregateCampaignStatus } from "../../jobs/marketing.js";
import type { CampaignBatchJob, CampaignQueue } from "../../jobs/marketing.js";
import { getQueue, QUEUE_NAMES } from "../../jobs/queues.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import {
  createCommunicationProviderRegistry,
  type CommunicationProviderRegistry,
  ProviderNotConfiguredError,
} from "../../providers/communications.js";
import { enqueueCommunication } from "../../jobs/communications.js";

type CampaignChannel = "email" | "whatsapp";

type Segment =
  | { type: "all" }
  | { type: "inactive"; days_since_last_visit: number }
  | { type: "tag"; tag: string }
  | { type: "high_loyalty"; min_points: number };

interface RecipientPreviewRow extends Record<string, unknown> {
  customer_id: string;
  destination: string | null;
  name: string;
  reason?: "MISSING_EMAIL" | "MISSING_PHONE" | "MISSING_WHATSAPP_CONSENT";
}

export interface MarketingRouteDependencies {
  campaignQueue?: CampaignQueue;
  providers?: CommunicationProviderRegistry;
}

const enforceTenant: preHandlerHookHandler = async (request, reply) => {
  const params = request.params as { id?: string };
  if (params.id !== request.salonId) {
    await reply.code(403).send({ error: "FORBIDDEN" });
  }
};

const guard = [
  authenticate,
  enforceTenant,
  requireModule(MODULE_KEYS.MARKETING),
  requirePermission(PERMISSION_KEYS.MARKETING_SEND),
];

async function resolveSegment(
  app: FastifyInstance,
  salonId: string,
  channel: CampaignChannel,
  segment: Segment,
) {
  const destination = channel === "email" ? customers.email : customers.phoneNormalized;
  const communicationConsent = channel === "whatsapp"
    ? sql`exists (
      select 1 from ${communicationConsents}
      where ${communicationConsents.salonId} = ${customers.salonId}
        and ${communicationConsents.customerId} = ${customers.id}
        and ${communicationConsents.channel} = 'whatsapp'
        and ${communicationConsents.purpose} = 'marketing'
        and ${communicationConsents.status} = 'granted'
    )`
    : undefined;
  const base = app.db
    .select({ customerId: customers.id, destination })
    .from(customers);

  if (segment.type === "inactive") {
    const cutoff = new Date(
      Date.now() - segment.days_since_last_visit * 24 * 60 * 60_000,
    );
    return base.where(
      and(
        eq(customers.salonId, salonId),
        sql`${destination} is not null`,
        ...(communicationConsent ? [communicationConsent] : []),
        sql`not exists (
          select 1 from ${appointments}
          where ${appointments.customerId} = ${customers.id}
          and ${appointments.startsAt} >= ${cutoff}
          and ${appointments.status} = 'completed'
        )`,
      ),
    );
  }
  if (segment.type === "tag") {
    return base.where(
      and(
        eq(customers.salonId, salonId),
        sql`${destination} is not null`,
        ...(communicationConsent ? [communicationConsent] : []),
        sql`${segment.tag} = any(${customers.tags})`,
      ),
    );
  }
  if (segment.type === "high_loyalty") {
    return base
      .leftJoin(loyaltyPoints, eq(loyaltyPoints.customerId, customers.id))
      .where(
        and(
          eq(customers.salonId, salonId),
          sql`${destination} is not null`,
          ...(communicationConsent ? [communicationConsent] : []),
        ),
      )
      .groupBy(customers.id)
      .having(
        sql`coalesce(sum(${loyaltyPoints.delta}), 0) >= ${segment.min_points}`,
      );
  }
  return base.where(
    and(eq(customers.salonId, salonId), sql`${destination} is not null`, ...(communicationConsent ? [communicationConsent] : [])),
  );
}

async function resolveSegmentPreview(
  app: FastifyInstance,
  salonId: string,
  channel: CampaignChannel,
  segment: Segment,
) {
  const destination = channel === "email" ? customers.email : customers.phoneNormalized;
  const base = app.db
    .select({ customerId: customers.id, destination, name: customers.fullName })
    .from(customers);
  let rows: Array<{ customerId: string; destination: string | null; name: string }>;
  if (segment.type === "inactive") {
    const cutoff = new Date(Date.now() - segment.days_since_last_visit * 24 * 60 * 60_000);
    rows = await base.where(and(
      eq(customers.salonId, salonId),
      sql`not exists (
        select 1 from ${appointments}
        where ${appointments.customerId} = ${customers.id}
        and ${appointments.startsAt} >= ${cutoff}
        and ${appointments.status} = 'completed'
      )`,
    ));
  } else if (segment.type === "tag") {
    rows = await base.where(and(
      eq(customers.salonId, salonId),
      sql`${segment.tag} = any(${customers.tags})`,
    ));
  } else if (segment.type === "high_loyalty") {
    rows = await base
      .leftJoin(loyaltyPoints, eq(loyaltyPoints.customerId, customers.id))
      .where(eq(customers.salonId, salonId))
      .groupBy(customers.id)
      .having(sql`coalesce(sum(${loyaltyPoints.delta}), 0) >= ${segment.min_points}`);
  } else {
    rows = await base.where(eq(customers.salonId, salonId));
  }

  const consentedCustomerIds = channel === "whatsapp"
    ? new Set((await app.db.select({ customerId: communicationConsents.customerId }).from(communicationConsents).where(and(
      eq(communicationConsents.salonId, salonId),
      eq(communicationConsents.channel, "whatsapp"),
      eq(communicationConsents.purpose, "marketing"),
      eq(communicationConsents.status, "granted"),
    ))).map((row) => row.customerId))
    : undefined;
  const eligible: RecipientPreviewRow[] = [];
  const excluded: RecipientPreviewRow[] = [];
  for (const row of rows) {
    const item = {
      customer_id: row.customerId,
      destination: row.destination,
      name: row.name,
    };
    if (row.destination?.trim() && (channel !== "whatsapp" || consentedCustomerIds?.has(row.customerId))) eligible.push(item);
    else excluded.push({
      ...item,
      reason: !row.destination?.trim()
        ? channel === "email" ? "MISSING_EMAIL" : "MISSING_PHONE"
        : "MISSING_WHATSAPP_CONSENT",
    });
  }
  return {
    eligible,
    eligible_count: eligible.length,
    excluded,
    excluded_count: excluded.length,
  };
}

async function enqueueBatches(
  queue: CampaignQueue,
  campaignId: string,
  recipientIds: string[],
  delay: number,
) {
  for (let index = 0; index < recipientIds.length; index += 50) {
    const batch = recipientIds.slice(index, index + 50);
    await queue.add(
      "send-batch",
      { campaignId, recipientIds: batch } satisfies CampaignBatchJob,
      {
        delay,
        removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    );
  }
}

function validTestSendBody(value: unknown): value is {
  channel: CampaignChannel;
  content?: string;
  destination: string;
  subject?: string;
  template_id?: string;
  whatsapp_template_parameters?: string[];
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    (body.channel === "email" || body.channel === "whatsapp") &&
    typeof body.destination === "string" &&
    body.destination.trim().length > 0 &&
    (body.subject === undefined || typeof body.subject === "string") &&
    (body.channel === "email"
      ? typeof body.content === "string" && body.content.trim().length > 0
      : typeof body.template_id === "string" && body.template_id.trim().length > 0 &&
        body.whatsapp_template_name === undefined && body.whatsapp_template_locale === undefined &&
        (body.whatsapp_template_parameters === undefined || (Array.isArray(body.whatsapp_template_parameters) && body.whatsapp_template_parameters.every((item) => typeof item === "string"))))
  );
}

function validSegment(value: unknown): value is Segment {
  if (!value || typeof value !== "object") return false;
  const segment = value as Record<string, unknown>;
  if (segment.type === "all") return true;
  if (segment.type === "inactive") {
    return Number.isFinite(segment.days_since_last_visit) && Number(segment.days_since_last_visit) > 0;
  }
  if (segment.type === "tag") return typeof segment.tag === "string" && segment.tag.trim().length > 0;
  return segment.type === "high_loyalty" && Number.isFinite(segment.min_points) && Number(segment.min_points) >= 0;
}

function validCampaignDraft(value: unknown): value is {
  channel: CampaignChannel;
  content?: string;
  name: string;
  scheduled_at?: string;
  target_segment: Segment;
  template_id?: string;
  whatsapp_template_parameters?: string[];
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    (body.channel === "email" || body.channel === "whatsapp") &&
    typeof body.name === "string" && body.name.trim().length > 0 &&
    validSegment(body.target_segment) &&
    (body.channel === "email"
      ? typeof body.content === "string" && body.content.trim().length > 0
      : typeof body.template_id === "string" && body.template_id.trim().length > 0 &&
        body.whatsapp_template_name === undefined && body.whatsapp_template_locale === undefined &&
        (body.whatsapp_template_parameters === undefined || (Array.isArray(body.whatsapp_template_parameters) && body.whatsapp_template_parameters.every((item) => typeof item === "string")))) &&
    (body.scheduled_at === undefined || (
      typeof body.scheduled_at === "string" && !Number.isNaN(Date.parse(body.scheduled_at))
    ))
  );
}

async function approvedWhatsAppTemplate(
  db: DrizzleDB,
  salonId: string,
  templateId: string,
) {
  return (await db.select().from(campaignTemplates).where(and(
    eq(campaignTemplates.id, templateId),
    eq(campaignTemplates.salonId, salonId),
    eq(campaignTemplates.channel, "whatsapp"),
    eq(campaignTemplates.active, true),
    eq(campaignTemplates.whatsappApprovalStatus, "approved"),
  )))[0];
}

function hasMatchingTemplateParameters(
  template: typeof campaignTemplates.$inferSelect,
  parameters: string[],
): boolean {
  return Boolean(template.whatsappTemplateName) &&
    Boolean(template.whatsappTemplateLocale) &&
    parameters.length === template.variables.length;
}

function validTemplateBody(value: unknown): value is {
  channel: CampaignChannel;
  content: string;
  name: string;
  whatsapp_template_locale?: string;
  whatsapp_template_name?: string;
  variables?: string[];
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    (body.channel === "email" || body.channel === "whatsapp") &&
    typeof body.content === "string" && body.content.trim().length > 0 &&
    typeof body.name === "string" && body.name.trim().length > 0 &&
    (body.variables === undefined || (
      Array.isArray(body.variables) && body.variables.every((item) => typeof item === "string")
    )) &&
    (body.channel !== "whatsapp" || (
      typeof body.whatsapp_template_name === "string" && body.whatsapp_template_name.trim().length > 0 &&
      typeof body.whatsapp_template_locale === "string" && body.whatsapp_template_locale.trim().length > 0
    ))
  );
}

export async function registerMarketingRoutes(
  app: FastifyInstance,
  dependencies: MarketingRouteDependencies = {},
) {
  const providers =
    dependencies.providers ?? createCommunicationProviderRegistry();
  const campaignQueue =
    dependencies.campaignQueue ?? getQueue(QUEUE_NAMES.CAMPAIGNS);

  async function recordQueueFailure(campaignId: string, recipientIds: string[]) {
    await app.db.transaction(async (tx) => {
      await tx
        .update(campaignRecipients)
        .set({
          error: "CAMPAIGN_QUEUE_UNAVAILABLE",
          status: "failed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignRecipients.campaignId, campaignId),
            inArray(campaignRecipients.id, recipientIds),
            eq(campaignRecipients.status, "queued"),
          ),
        );
      const recipients = await tx
        .select({ status: campaignRecipients.status })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId));
      await tx
        .update(marketingCampaigns)
        .set({
          status: aggregateCampaignStatus(recipients),
          updatedAt: new Date(),
        })
        .where(eq(marketingCampaigns.id, campaignId));
    });
  }

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/campaigns/readiness",
    { preHandler: guard },
    async (request) => {
      const account = (await app.db.select({ enabled: communicationProviderAccounts.enabled, status: communicationProviderAccounts.status })
        .from(communicationProviderAccounts)
        .where(and(eq(communicationProviderAccounts.salonId, request.salonId), eq(communicationProviderAccounts.provider, "meta_cloud_api"))))[0];
      return { email: providers.status().email, whatsapp: account?.enabled && account.status === "ready" ? "ready" : "not_configured" };
    },
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/salons/:id/campaigns/test-send",
    { preHandler: guard },
    async (request, reply) => {
      if (!validTestSendBody(request.body)) {
        return reply.code(400).send({ error: "INVALID_REQUEST" });
      }
      const body = request.body;
      try {
        let whatsappTemplate: typeof campaignTemplates.$inferSelect | undefined;
        if (body.channel === "whatsapp") {
          const normalized = body.destination.replace(/\D/g, "");
          const customer = (await app.db.select({ id: customers.id }).from(customers).where(and(
            eq(customers.salonId, request.salonId),
            sql`regexp_replace(coalesce(${customers.phone}, ''), '[^0-9]', '', 'g') = ${normalized}`,
          )))[0];
          const consent = customer && (await app.db.select({ id: communicationConsents.id }).from(communicationConsents).where(and(
            eq(communicationConsents.salonId, request.salonId), eq(communicationConsents.customerId, customer.id),
            eq(communicationConsents.channel, "whatsapp"), eq(communicationConsents.purpose, "marketing"), eq(communicationConsents.status, "granted"),
          )))[0];
          if (!consent) return reply.code(403).send({ error: "WHATSAPP_MARKETING_CONSENT_REQUIRED" });
          whatsappTemplate = await approvedWhatsAppTemplate(app.db, request.salonId, body.template_id!);
          if (!whatsappTemplate) return reply.code(409).send({ error: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
          if (!hasMatchingTemplateParameters(whatsappTemplate, body.whatsapp_template_parameters ?? [])) {
            return reply.code(400).send({ error: "WHATSAPP_TEMPLATE_PARAMETER_MISMATCH" });
          }
        }
        const receipt = body.channel === "email" ? await providers.send(
          body.channel === "email"
            ? {
                channel: "email",
                html: body.content!,
                idempotencyKey: `test-send-${request.salonId}-${randomUUID()}`,
                subject: body.subject?.trim() || "Test comunicazione",
                to: body.destination,
              }
            : undefined as never,
        ) : await enqueueCommunication(app.db, {
          idempotencyKey: `test-send-${request.salonId}-${randomUUID()}`,
          kind: "template",
          salonId: request.salonId,
          sourceType: "marketing_test",
          template: {
            locale: whatsappTemplate!.whatsappTemplateLocale!,
            name: whatsappTemplate!.whatsappTemplateName!,
            parameters: body.whatsapp_template_parameters ?? [],
          },
          to: body.destination,
        }).then((queued) => ({ acceptedAt: new Date(), provider: "meta_cloud_api", providerMessageId: queued.messageId }));
        return {
          accepted_at: receipt.acceptedAt.toISOString(),
          provider: receipt.provider,
          provider_message_id: receipt.providerMessageId,
        };
      } catch (error) {
        if (error instanceof ProviderNotConfiguredError) {
          return reply
            .code(503)
            .send({ error: "PROVIDER_NOT_CONFIGURED", channel: error.channel });
        }
        return reply.code(502).send({ error: "PROVIDER_DELIVERY_FAILED" });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/salons/:id/campaigns/preview",
    { preHandler: guard },
    async (request, reply) => {
      if (!request.body || typeof request.body !== "object") {
        return reply.code(400).send({ error: "INVALID_REQUEST" });
      }
      const body = request.body as Record<string, unknown>;
      if ((body.channel !== "email" && body.channel !== "whatsapp") || !validSegment(body.target_segment)) {
        return reply.code(400).send({ error: "INVALID_REQUEST" });
      }
      const preview = await resolveSegmentPreview(
        app,
        request.salonId,
        body.channel,
        body.target_segment,
      );
      return {
        ...preview,
        eligible: preview.eligible.slice(0, 20),
        excluded: preview.excluded.slice(0, 20),
      };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { include_archived?: string } }>(
    "/api/salons/:id/campaign-templates",
    { preHandler: guard },
    async (request) => app.db
      .select()
      .from(campaignTemplates)
      .where(request.query.include_archived === "true"
        ? eq(campaignTemplates.salonId, request.salonId)
        : and(eq(campaignTemplates.salonId, request.salonId), eq(campaignTemplates.active, true)))
      .orderBy(desc(campaignTemplates.updatedAt)),
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/salons/:id/campaign-templates",
    { preHandler: guard },
    async (request, reply) => {
      if (!validTemplateBody(request.body)) {
        return reply.code(400).send({ error: "INVALID_REQUEST" });
      }
      const body = request.body;
      const rows = await app.db.insert(campaignTemplates).values({
        channel: body.channel,
        content: body.content,
        name: body.name.trim(),
        salonId: request.salonId,
        variables: body.variables ?? [],
        whatsappTemplateLocale: body.whatsapp_template_locale?.trim() || null,
        whatsappTemplateName: body.whatsapp_template_name?.trim() || null,
      }).returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.patch<{ Params: { id: string; templateId: string }; Body: unknown }>(
    "/api/salons/:id/campaign-templates/:templateId",
    { preHandler: guard },
    async (request, reply) => {
      if (!validTemplateBody(request.body)) {
        return reply.code(400).send({ error: "INVALID_REQUEST" });
      }
      const body = request.body;
      const rows = await app.db.transaction(async (tx) => {
        const existing = (await tx.select().from(campaignTemplates).where(and(
          eq(campaignTemplates.id, request.params.templateId),
          eq(campaignTemplates.salonId, request.salonId),
        )).for("update"))[0];
        if (!existing) return [];
        const variables = body.variables ?? [];
        const whatsappTemplateLocale = body.whatsapp_template_locale?.trim() || null;
        const whatsappTemplateName = body.whatsapp_template_name?.trim() || null;
        const contractChanged = existing.channel === "whatsapp" && (
          body.channel !== "whatsapp" ||
          existing.whatsappTemplateLocale !== whatsappTemplateLocale ||
          existing.whatsappTemplateName !== whatsappTemplateName ||
          JSON.stringify(existing.variables) !== JSON.stringify(variables)
        );
        return tx.update(campaignTemplates).set({
          channel: body.channel,
          content: body.content,
          name: body.name.trim(),
          updatedAt: new Date(),
          variables,
          whatsappTemplateLocale,
          whatsappTemplateName,
          ...(contractChanged && {
            whatsappApprovalSource: null,
            whatsappApprovalStatus: null,
            whatsappApprovedAt: null,
          }),
        }).where(eq(campaignTemplates.id, existing.id)).returning();
      });
      return rows[0] ?? reply.code(404).send({ error: "TEMPLATE_NOT_FOUND" });
    },
  );

  app.post<{ Params: { id: string; templateId: string } }>(
    "/api/salons/:id/campaign-templates/:templateId/archive",
    { preHandler: guard },
    async (request, reply) => {
      const rows = await app.db.update(campaignTemplates).set({
        active: false,
        updatedAt: new Date(),
      }).where(and(
        eq(campaignTemplates.id, request.params.templateId),
        eq(campaignTemplates.salonId, request.salonId),
      )).returning();
      return rows[0] ?? reply.code(404).send({ error: "TEMPLATE_NOT_FOUND" });
    },
  );

  app.post<{
    Params: { id: string; templateId: string };
    Body: { campaign_id?: string };
  }>(
    "/api/salons/:id/campaign-templates/:templateId/apply",
    { preHandler: guard },
    async (request, reply) => {
      if (!request.body?.campaign_id) {
        return reply.code(400).send({ error: "INVALID_REQUEST" });
      }
      const templates = await app.db.select().from(campaignTemplates).where(and(
        eq(campaignTemplates.id, request.params.templateId),
        eq(campaignTemplates.salonId, request.salonId),
        eq(campaignTemplates.active, true),
      ));
      const template = templates[0];
      if (!template) return reply.code(404).send({ error: "TEMPLATE_NOT_FOUND" });
      if (template.channel === "whatsapp" && (template.whatsappApprovalStatus !== "approved" || !template.whatsappTemplateName || !template.whatsappTemplateLocale)) {
        return reply.code(409).send({ error: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
      }
      const campaigns = await app.db.update(marketingCampaigns).set({
        channel: template.channel,
        content: template.content,
        templateId: template.id,
        whatsappTemplateLocale: template.whatsappTemplateLocale,
        whatsappTemplateName: template.whatsappTemplateName,
        whatsappTemplateApprovalStatus: template.whatsappApprovalStatus,
        updatedAt: new Date(),
      }).where(and(
        eq(marketingCampaigns.id, request.body.campaign_id),
        eq(marketingCampaigns.salonId, request.salonId),
        eq(marketingCampaigns.status, "draft"),
      )).returning();
      return campaigns[0] ?? reply.code(409).send({ error: "CAMPAIGN_NOT_EDITABLE" });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/campaigns",
    { preHandler: guard },
    async (request) =>
      app.db
        .select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.salonId, request.salonId))
        .orderBy(desc(marketingCampaigns.createdAt)),
  );

  app.post<{
    Params: { id: string };
    Body: {
      name: string;
      channel: CampaignChannel;
      target_segment: Segment;
      content?: string;
      scheduled_at?: string;
      template_id?: string;
      whatsapp_template_parameters?: string[];
    };
  }>("/api/salons/:id/campaigns", { preHandler: guard }, async (request, reply) => {
    if (!validCampaignDraft(request.body)) {
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    }
    const template = request.body.channel === "whatsapp"
      ? await approvedWhatsAppTemplate(app.db, request.salonId, request.body.template_id!)
      : undefined;
    if (request.body.channel === "whatsapp" && !template) {
      return reply.code(409).send({ error: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
    }
    if (template && !hasMatchingTemplateParameters(template, request.body.whatsapp_template_parameters ?? [])) {
      return reply.code(400).send({ error: "WHATSAPP_TEMPLATE_PARAMETER_MISMATCH" });
    }
    const preview = await resolveSegmentPreview(
      app,
      request.salonId,
      request.body.channel,
      request.body.target_segment,
    );
    const rows = await app.db
      .insert(marketingCampaigns)
      .values({
        salonId: request.salonId,
        name: request.body.name,
        channel: request.body.channel,
        targetSegment: request.body.target_segment,
        content: template?.content ?? request.body.content!,
        templateId: template?.id ?? null,
        whatsappTemplateApprovalStatus: template?.whatsappApprovalStatus ?? null,
        whatsappTemplateLocale: template?.whatsappTemplateLocale ?? null,
        whatsappTemplateName: template?.whatsappTemplateName ?? null,
        whatsappTemplateParameters: request.body.whatsapp_template_parameters ?? [],
        recipientPreview: [...preview.eligible, ...preview.excluded].slice(0, 40),
        scheduledAt: request.body.scheduled_at
          ? new Date(request.body.scheduled_at)
          : null,
      })
      .returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{
    Params: { id: string; campaignId: string };
    Body: Partial<{
      name: string;
      channel: CampaignChannel;
      target_segment: Segment;
      content: string;
      scheduled_at: string | null;
      whatsapp_template_locale: string | null;
      whatsapp_template_name: string | null;
      whatsapp_template_parameters: string[];
    }>;
  }>("/api/salons/:id/campaigns/:campaignId", { preHandler: guard }, async (request, reply) => {
    if (request.body.whatsapp_template_locale !== undefined || request.body.whatsapp_template_name !== undefined || request.body.whatsapp_template_parameters !== undefined) {
      return reply.code(400).send({ error: "WHATSAPP_TEMPLATE_IMMUTABLE" });
    }
    const rows = await app.db
      .update(marketingCampaigns)
      .set({
        ...(request.body.name !== undefined && { name: request.body.name }),
        ...(request.body.channel !== undefined && { channel: request.body.channel }),
        ...(request.body.target_segment !== undefined && {
          targetSegment: request.body.target_segment,
        }),
        ...(request.body.content !== undefined && { content: request.body.content }),
        ...(request.body.whatsapp_template_locale !== undefined && { whatsappTemplateLocale: request.body.whatsapp_template_locale }),
        ...(request.body.whatsapp_template_name !== undefined && { whatsappTemplateName: request.body.whatsapp_template_name }),
        ...(request.body.whatsapp_template_parameters !== undefined && { whatsappTemplateParameters: request.body.whatsapp_template_parameters }),
        ...(request.body.scheduled_at !== undefined && {
          scheduledAt: request.body.scheduled_at
            ? new Date(request.body.scheduled_at)
            : null,
        }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(marketingCampaigns.id, request.params.campaignId),
          eq(marketingCampaigns.salonId, request.salonId),
          eq(marketingCampaigns.status, "draft"),
        ),
      )
      .returning();
    return rows[0] ?? reply.code(409).send({ error: "CAMPAIGN_NOT_EDITABLE" });
  });

  async function scheduleCampaign(
    request: { params: { campaignId: string }; salonId: string },
    reply: FastifyReply,
  ) {
    const rows = await app.db
      .select()
      .from(marketingCampaigns)
      .where(
        and(
          eq(marketingCampaigns.id, request.params.campaignId),
          eq(marketingCampaigns.salonId, request.salonId),
        ),
      );
    const campaign = rows[0];
    if (!campaign || campaign.status !== "draft") {
      return reply.code(409).send({ error: "CAMPAIGN_NOT_SENDABLE" });
    }
    if (campaign.channel !== "email" && campaign.channel !== "whatsapp") {
      return reply.code(409).send({ error: "HISTORICAL_CAMPAIGN_NOT_SENDABLE" });
    }
    if (campaign.channel === "whatsapp" && (campaign.whatsappTemplateApprovalStatus !== "approved" || !campaign.templateId || !campaign.whatsappTemplateName || !campaign.whatsappTemplateLocale)) {
      return reply.code(409).send({ error: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
    }
    if (campaign.channel === "whatsapp") {
      const template = await approvedWhatsAppTemplate(app.db, request.salonId, campaign.templateId!);
      if (!template || !hasMatchingTemplateParameters(template, campaign.whatsappTemplateParameters)) {
        return reply.code(409).send({ error: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
      }
    }
    const whatsappReady = campaign.channel === "whatsapp" && (await app.db.select({ id: communicationProviderAccounts.id }).from(communicationProviderAccounts).where(and(
      eq(communicationProviderAccounts.salonId, request.salonId),
      eq(communicationProviderAccounts.provider, "meta_cloud_api"),
      eq(communicationProviderAccounts.enabled, true),
      eq(communicationProviderAccounts.status, "ready"),
    ))).length > 0;
    if ((campaign.channel === "email" && providers.status().email !== "ready") || (campaign.channel === "whatsapp" && !whatsappReady)) {
      return reply.code(503).send({
        channel: campaign.channel,
        error: "PROVIDER_NOT_CONFIGURED",
      });
    }
    const recipients = await resolveSegment(
      app,
      request.salonId,
      campaign.channel,
      campaign.targetSegment as Segment,
    );
    if (recipients.length === 0) {
      await app.db
        .update(marketingCampaigns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(marketingCampaigns.id, campaign.id));
      return reply.code(409).send({ error: "CAMPAIGN_HAS_NO_RECIPIENTS" });
    }

    const delay = campaign.scheduledAt
      ? Math.max(0, campaign.scheduledAt.getTime() - Date.now())
      : 0;
    const status = delay > 0 ? "scheduled" : "queued";
    const inserted = await app.db.transaction(async (tx) => {
      const claimed = await tx
        .update(marketingCampaigns)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(marketingCampaigns.id, campaign.id),
            eq(marketingCampaigns.salonId, request.salonId),
            eq(marketingCampaigns.status, "draft"),
          ),
        )
        .returning({ id: marketingCampaigns.id });
      if (!claimed[0]) return undefined;
      return tx
        .insert(campaignRecipients)
        .values(
          recipients.map((recipient) => ({
            campaignId: campaign.id,
            customerId: recipient.customerId,
            destination: recipient.destination!,
            salonId: request.salonId,
            status: "queued",
          })),
        )
        .onConflictDoNothing()
        .returning({ id: campaignRecipients.id });
    });
    if (!inserted) {
      return reply.code(409).send({ error: "CAMPAIGN_NOT_SENDABLE" });
    }
    try {
      await enqueueBatches(
        campaignQueue,
        campaign.id,
        inserted.map((recipient) => recipient.id),
        delay,
      );
    } catch {
      await recordQueueFailure(
        campaign.id,
        inserted.map((recipient) => recipient.id),
      );
      return reply.code(503).send({ error: "CAMPAIGN_QUEUE_UNAVAILABLE" });
    }
    return reply.code(202).send({
      campaign_id: campaign.id,
      recipient_count: inserted.length,
      status,
    });
  }

  app.post<{ Params: { id: string; campaignId: string } }>(
    "/api/salons/:id/campaigns/:campaignId/schedule",
    { preHandler: guard },
    scheduleCampaign,
  );

  app.post<{ Params: { id: string; campaignId: string } }>(
    "/api/salons/:id/campaigns/:campaignId/send",
    { preHandler: guard },
    scheduleCampaign,
  );

  app.post<{ Params: { id: string; campaignId: string } }>(
    "/api/salons/:id/campaigns/:campaignId/cancel",
    { preHandler: guard },
    async (request, reply) => {
      const cancelled = await app.db.transaction(async (tx) => {
        const rows = await tx
          .update(marketingCampaigns)
          .set({
            cancelledAt: new Date(),
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(marketingCampaigns.id, request.params.campaignId),
              eq(marketingCampaigns.salonId, request.salonId),
              inArray(marketingCampaigns.status, ["queued", "scheduled"]),
            ),
          )
          .returning();
        if (!rows[0]) return undefined;
        await tx
          .update(campaignRecipients)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(
            and(
              eq(campaignRecipients.campaignId, rows[0].id),
              eq(campaignRecipients.salonId, request.salonId),
              inArray(campaignRecipients.status, ["pending", "queued"]),
            ),
          );
        return rows[0];
      });
      if (cancelled) return cancelled;
      const existing = await app.db
        .select({ status: marketingCampaigns.status })
        .from(marketingCampaigns)
        .where(
          and(
            eq(marketingCampaigns.id, request.params.campaignId),
            eq(marketingCampaigns.salonId, request.salonId),
          ),
        );
      return reply.code(409).send({
        error:
          existing[0]?.status === "processing"
            ? "CAMPAIGN_ALREADY_PROCESSING"
            : "CAMPAIGN_NOT_CANCELLABLE",
      });
    },
  );

  app.post<{ Params: { id: string; campaignId: string } }>(
    "/api/salons/:id/campaigns/:campaignId/retry-failures",
    { preHandler: guard },
    async (request, reply) => {
      const recipientIds = await app.db.transaction(async (tx) => {
        const campaigns = await tx
          .select({ channel: marketingCampaigns.channel, id: marketingCampaigns.id })
          .from(marketingCampaigns)
          .where(
            and(
              eq(marketingCampaigns.id, request.params.campaignId),
              eq(marketingCampaigns.salonId, request.salonId),
              inArray(marketingCampaigns.status, ["failed", "partial"]),
            ),
        );
        const campaign = campaigns[0];
        if (!campaign) return undefined;
        if (campaign.channel !== "email" && campaign.channel !== "whatsapp") return undefined;
        if (campaign.channel === "email" && providers.status().email !== "ready") return null;
        if (campaign.channel === "whatsapp") {
          const ready = (await tx.select({ id: communicationProviderAccounts.id }).from(communicationProviderAccounts).where(and(
            eq(communicationProviderAccounts.salonId, request.salonId),
            eq(communicationProviderAccounts.provider, "meta_cloud_api"),
            eq(communicationProviderAccounts.enabled, true),
            eq(communicationProviderAccounts.status, "ready"),
          ))).length > 0;
          if (!ready) return null;
        }
        const queued = await tx
          .update(campaignRecipients)
          .set({ error: null, status: "queued", updatedAt: new Date() })
          .where(
            and(
              eq(campaignRecipients.campaignId, campaign.id),
              eq(campaignRecipients.salonId, request.salonId),
              eq(campaignRecipients.status, "failed"),
            ),
          )
          .returning({ id: campaignRecipients.id });
        if (queued.length) {
          await tx
            .update(marketingCampaigns)
            .set({ status: "processing", updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, campaign.id));
        }
        return queued.map((recipient) => recipient.id);
      });
      if (recipientIds === null) {
        return reply.code(503).send({ error: "PROVIDER_NOT_CONFIGURED" });
      }
      if (!recipientIds?.length) {
        return reply.code(409).send({ error: "CAMPAIGN_HAS_NO_FAILED_RECIPIENTS" });
      }
      try {
        await enqueueBatches(campaignQueue, request.params.campaignId, recipientIds, 0);
      } catch {
        await recordQueueFailure(request.params.campaignId, recipientIds);
        return reply.code(503).send({ error: "CAMPAIGN_QUEUE_UNAVAILABLE" });
      }
      return reply.code(202).send({ queued: recipientIds.length, status: "processing" });
    },
  );

  app.get<{ Params: { id: string; campaignId: string } }>(
    "/api/salons/:id/campaigns/:campaignId/stats",
    { preHandler: guard },
    async (request) => {
      const rows = await app.db
        .select({
          failed_count: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'failed')`,
          processing_count: sql<number>`count(*) filter (where ${campaignRecipients.status} in ('pending', 'queued', 'processing'))`,
          recipient_count: sql<number>`count(*)`,
          sent_count: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'sent')`,
        })
        .from(campaignRecipients)
        .where(
          and(
            eq(campaignRecipients.campaignId, request.params.campaignId),
            eq(campaignRecipients.salonId, request.salonId),
          ),
        );
      return rows[0];
    },
  );
}
