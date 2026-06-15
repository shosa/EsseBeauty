import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  appointments,
  campaignRecipients,
  customers,
  loyaltyPoints,
  marketingCampaigns,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import type { CampaignBatchJob } from "../../jobs/marketing.js";
import { getQueue, QUEUE_NAMES } from "../../jobs/queues.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";

type Segment =
  | { type: "all" }
  | { type: "inactive"; days_since_last_visit: number }
  | { type: "tag"; tag: string }
  | { type: "high_loyalty"; min_points: number };

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.MARKETING),
  requirePermission(PERMISSION_KEYS.MARKETING_SEND),
];

async function resolveSegment(
  app: FastifyInstance,
  salonId: string,
  channel: "email" | "sms",
  segment: Segment,
) {
  const destination =
    channel === "email" ? customers.email : customers.phone;
  const base = app.db
    .select({
      customerId: customers.id,
      destination,
    })
    .from(customers);

  if (segment.type === "inactive") {
    const cutoff = new Date(
      Date.now() - segment.days_since_last_visit * 24 * 60 * 60_000,
    );
    return base.where(
      and(
        eq(customers.salonId, salonId),
        sql`${destination} is not null`,
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
        ),
      )
      .groupBy(customers.id)
      .having(
        sql`coalesce(sum(${loyaltyPoints.delta}), 0) >= ${segment.min_points}`,
      );
  }
  return base.where(
    and(
      eq(customers.salonId, salonId),
      sql`${destination} is not null`,
    ),
  );
}

export async function registerMarketingRoutes(app: FastifyInstance) {
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
      channel: "email" | "sms";
      target_segment: Segment;
      content: string;
      scheduled_at?: string;
    };
  }>("/api/salons/:id/campaigns", { preHandler: guard }, async (request, reply) => {
    if (request.body.channel === "sms" && request.body.content.length > 160) {
      return reply.code(400).send({ error: "SMS_TOO_LONG" });
    }
    const rows = await app.db
      .insert(marketingCampaigns)
      .values({
        salonId: request.salonId,
        name: request.body.name,
        channel: request.body.channel,
        targetSegment: request.body.target_segment,
        content: request.body.content,
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
      channel: "email" | "sms";
      target_segment: Segment;
      content: string;
      scheduled_at: string | null;
    }>;
  }>("/api/salons/:id/campaigns/:campaignId", { preHandler: guard }, async (request, reply) => {
    const rows = await app.db
      .update(marketingCampaigns)
      .set({
        ...(request.body.name !== undefined && { name: request.body.name }),
        ...(request.body.channel !== undefined && {
          channel: request.body.channel,
        }),
        ...(request.body.target_segment !== undefined && {
          targetSegment: request.body.target_segment,
        }),
        ...(request.body.content !== undefined && {
          content: request.body.content,
        }),
        ...(request.body.scheduled_at !== undefined && {
          scheduledAt: request.body.scheduled_at
            ? new Date(request.body.scheduled_at)
            : null,
        }),
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

  app.post<{ Params: { id: string; campaignId: string } }>(
    "/api/salons/:id/campaigns/:campaignId/send",
    { preHandler: guard },
    async (request, reply) => {
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
      const recipients = await resolveSegment(
        app,
        request.salonId,
        campaign.channel,
        campaign.targetSegment as Segment,
      );
      const inserted = recipients.length
        ? await app.db
            .insert(campaignRecipients)
            .values(
              recipients.map((recipient) => ({
                campaignId: campaign.id,
                salonId: request.salonId,
                customerId: recipient.customerId,
                destination: recipient.destination!,
              })),
            )
            .onConflictDoNothing()
            .returning({ id: campaignRecipients.id })
        : [];
      const delay = campaign.scheduledAt
        ? Math.max(0, campaign.scheduledAt.getTime() - Date.now())
        : 0;
      for (let index = 0; index < inserted.length; index += 50) {
        const batch = inserted.slice(index, index + 50).map((item) => item.id);
        await getQueue(QUEUE_NAMES.CAMPAIGNS).add(
          "send-batch",
          {
            campaignId: campaign.id,
            recipientIds: batch,
          } satisfies CampaignBatchJob,
          { delay },
        );
      }
      const status = delay > 0 ? "scheduled" : "sent";
      const updated = await app.db
        .update(marketingCampaigns)
        .set({
          status,
          sentAt: delay > 0 ? null : new Date(),
        })
        .where(eq(marketingCampaigns.id, campaign.id))
        .returning();
      return updated[0];
    },
  );

  app.get<{ Params: { id: string; campaignId: string } }>(
    "/api/salons/:id/campaigns/:campaignId/stats",
    { preHandler: guard },
    async (request) => {
      const rows = await app.db
        .select({
          recipient_count: sql<number>`count(*)`,
          sent_count: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'sent')`,
          failed_count: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'failed')`,
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
