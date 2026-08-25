import { Worker, type Job, type JobsOptions } from "bullmq";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { campaignRecipients, campaignTemplates, communicationConsents, marketingCampaigns } from "@esse-beauty/db/schema";

import { refreshCampaignStatus } from "./campaign-status.js";

export { aggregateCampaignStatus, type AggregatedCampaignStatus } from "./campaign-status.js";

import {
  createCommunicationProviderRegistry,
  type CommunicationProviderRegistry,
  ProviderNotConfiguredError,
} from "../providers/communications.js";
import { enqueueCommunication } from "./communications.js";
import { QUEUE_NAMES, redisConnection } from "./queues.js";

export interface CampaignBatchJob {
  campaignId: string;
  recipientIds: string[];
}

export interface CampaignQueue {
  add(name: string, data: CampaignBatchJob, options?: JobsOptions): Promise<unknown>;
}


export async function processCampaignBatch(
  db: DrizzleDB,
  job: Pick<Job<CampaignBatchJob>, "data">,
  providers: CommunicationProviderRegistry = createCommunicationProviderRegistry(),
  enqueue: typeof enqueueCommunication = enqueueCommunication,
): Promise<void> {
  const campaigns = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, job.data.campaignId));
  const campaign = campaigns[0];
  if (!campaign || campaign.status === "cancelled") return;
  // Historical campaigns retain their recorded channel and are never repurposed
  // into a WhatsApp delivery at runtime.
  if (campaign.channel !== "email" && campaign.channel !== "whatsapp") return;

  const claimed = await db.transaction(async (tx) => {
    const started = await tx
      .update(marketingCampaigns)
      .set({
        processingStartedAt: campaign.processingStartedAt ?? new Date(),
        status: "processing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(marketingCampaigns.id, campaign.id),
          inArray(marketingCampaigns.status, ["queued", "scheduled", "processing"]),
        ),
      )
      .returning({ id: marketingCampaigns.id });
    if (!started[0]) return [];
    return tx
      .update(campaignRecipients)
      .set({
        deliveryAttempts: sql`${campaignRecipients.deliveryAttempts} + 1`,
        error: null,
        lastAttemptAt: new Date(),
        status: "processing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignRecipients.campaignId, campaign.id),
          eq(campaignRecipients.salonId, campaign.salonId),
          inArray(campaignRecipients.id, job.data.recipientIds),
          eq(campaignRecipients.status, "queued"),
        ),
      )
      .returning();
  });
  if (claimed.length === 0) return;

  for (const recipient of claimed) {
    try {
      if (campaign.channel === "whatsapp") {
        const consent = recipient.customerId && (await db.select({ id: communicationConsents.id })
          .from(communicationConsents)
          .where(and(
            eq(communicationConsents.salonId, campaign.salonId),
            eq(communicationConsents.customerId, recipient.customerId),
            eq(communicationConsents.channel, "whatsapp"),
            eq(communicationConsents.purpose, "marketing"),
            eq(communicationConsents.status, "granted"),
          )))[0];
        if (!consent) {
          await db.update(campaignRecipients).set({ error: "WHATSAPP_MARKETING_CONSENT_REVOKED", status: "skipped", updatedAt: new Date() })
            .where(eq(campaignRecipients.id, recipient.id));
          continue;
        }
        const template = campaign.templateId && (await db.select().from(campaignTemplates).where(and(
          eq(campaignTemplates.id, campaign.templateId),
          eq(campaignTemplates.salonId, campaign.salonId),
        )))[0];
        if (!template || !template.active || template.whatsappApprovalStatus !== "approved" || !template.whatsappTemplateName || !template.whatsappTemplateLocale || !campaign.whatsappTemplateName || !campaign.whatsappTemplateLocale || campaign.whatsappTemplateApprovalStatus !== "approved") {
          await db.update(campaignRecipients).set({ error: "WHATSAPP_TEMPLATE_NOT_APPROVED", status: "failed", updatedAt: new Date() })
            .where(eq(campaignRecipients.id, recipient.id));
          continue;
        }
        if (campaign.whatsappTemplateName !== template.whatsappTemplateName || campaign.whatsappTemplateLocale !== template.whatsappTemplateLocale) {
          await db.update(campaignRecipients).set({ error: "WHATSAPP_TEMPLATE_SNAPSHOT_STALE", status: "failed", updatedAt: new Date() })
            .where(eq(campaignRecipients.id, recipient.id));
          continue;
        }
        if (campaign.whatsappTemplateParameters.length !== template.variables.length) {
          await db.update(campaignRecipients).set({ error: "WHATSAPP_TEMPLATE_PARAMETER_MISMATCH", status: "failed", updatedAt: new Date() })
            .where(eq(campaignRecipients.id, recipient.id));
          continue;
        }
      }
      const receipt = campaign.channel === "email"
        ? await providers.send({
            channel: "email",
            html: campaign.content,
            idempotencyKey: `campaign-recipient-${recipient.id}`,
            subject: campaign.name,
            to: recipient.destination,
          })
        : await enqueue(db, {
            idempotencyKey: `campaign-recipient-${recipient.id}`,
            kind: "template",
            salonId: campaign.salonId,
            sourceId: recipient.id,
            sourceType: "campaign_recipient",
            template: {
              locale: campaign.whatsappTemplateLocale ?? "it",
              name: campaign.whatsappTemplateName ?? "",
              parameters: campaign.whatsappTemplateParameters,
            },
            to: recipient.destination,
          }).then((queued) => ({
            acceptedAt: new Date(),
            provider: null,
            providerMessageId: null,
          }));
      await db
        .update(campaignRecipients)
        .set({
          error: null,
          providerMessageId: receipt.providerMessageId,
          providerName: receipt.provider,
          sentAt: receipt.acceptedAt,
          status: campaign.channel === "whatsapp" ? "queued" : "sent",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignRecipients.id, recipient.id),
            eq(campaignRecipients.status, "processing"),
          ),
        );
    } catch (error) {
      await db
        .update(campaignRecipients)
        .set({
          error:
            error instanceof ProviderNotConfiguredError
              ? "PROVIDER_NOT_CONFIGURED"
              : "PROVIDER_DELIVERY_FAILED",
          providerMessageId: null,
          providerName: null,
          status: "failed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignRecipients.id, recipient.id),
            eq(campaignRecipients.status, "processing"),
          ),
        );
    }
  }

  await refreshCampaignStatus(db, campaign.id);
}

export function startMarketingWorker(
  db: DrizzleDB,
  providers: CommunicationProviderRegistry = createCommunicationProviderRegistry(),
): Worker<CampaignBatchJob> {
  return new Worker(
    QUEUE_NAMES.CAMPAIGNS,
    (job) => processCampaignBatch(db, job, providers),
    { connection: redisConnection() },
  );
}
