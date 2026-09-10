import { Worker, type Job } from "bullmq";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customerPushSubscriptions,
  customers,
  reminderSettings,
  reminders,
  salons,
  services,
  staff,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";

import { brandedEmailHtml, escapeHtml } from "../lib/email-branding.js";
import { sendCustomerAppMessage } from "../lib/customer-messages.js";
import { sendEmailFromDb } from "./notifications.js";
import { enqueueCommunication } from "./communications.js";
import { getQueue, QUEUE_NAMES, redisConnection } from "./queues.js";

interface ReminderJob {
  reminderId: string;
}

const REMINDER_TEMPLATE = "appointment_reminder";

export async function scheduleDueReminders(db: DrizzleDB): Promise<number> {
  const settings = await db.select().from(reminderSettings);
  let created = 0;

  for (const setting of settings) {
    if (
      !(await isModuleEnabled(setting.salonId, MODULE_KEYS.REMINDERS, db)) ||
      setting.hoursBefore.length === 0
    ) {
      continue;
    }
    const now = new Date();
    const limit = new Date(
      now.getTime() + Math.max(...setting.hoursBefore) * 60 * 60_000,
    );
    const rows = await db
      .select({
        appointmentId: appointments.id,
        customerId: appointments.customerId,
        startsAt: appointments.startsAt,
        customerName: customers.fullName,
        email: customers.email,
        phone: customers.phone,
        salonName: salons.name,
        salonSlug: salons.slug,
        serviceName: services.name,
        staffName: staff.displayName,
      })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(salons, eq(salons.id, appointments.salonId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(staff, eq(staff.id, appointments.staffId))
      .where(
        and(
          eq(appointments.salonId, setting.salonId),
          inArray(appointments.status, ["confirmed", "pending"]),
          gte(appointments.startsAt, now),
          lte(appointments.startsAt, limit),
        ),
      );

    const pushSubscribedCustomerIds = setting.appEnabled && rows.length > 0
      ? new Set((await db.select({ customerId: customerPushSubscriptions.customerId }).from(customerPushSubscriptions)
        .where(inArray(customerPushSubscriptions.customerId, rows.map((row) => row.customerId)))).map((row) => row.customerId))
      : new Set<string>();

    for (const item of rows) {
      for (const hours of setting.hoursBefore) {
        const scheduledAt = new Date(
          item.startsAt.getTime() - hours * 60 * 60_000,
        );
        if (scheduledAt > now || now.getTime() - scheduledAt.getTime() > 10 * 60_000) {
          continue;
        }
        const channels = [
          ...(setting.whatsappEnabled && item.phone ? ["whatsapp" as const] : []),
          ...(setting.emailEnabled && item.email ? ["email" as const] : []),
          ...(setting.appEnabled && pushSubscribedCustomerIds.has(item.customerId) ? ["app" as const] : []),
        ];
        for (const channel of channels) {
          const existing = await db
            .select({ id: reminders.id })
            .from(reminders)
            .where(
              and(
                eq(reminders.appointmentId, item.appointmentId),
                eq(reminders.channel, channel),
                eq(reminders.scheduledAt, scheduledAt),
              ),
            );
          if (existing[0]) continue;

          const inserted = await db
            .insert(reminders)
            .values({
              salonId: setting.salonId,
              appointmentId: item.appointmentId,
              channel,
              scheduledAt,
              payload: item,
            })
            .returning({ id: reminders.id });
          await getQueue(QUEUE_NAMES.REMINDERS).add("send", {
            reminderId: inserted[0]!.id,
          } satisfies ReminderJob);
          created += 1;
        }
      }
    }
  }
  return created;
}

export async function processReminder(
  db: DrizzleDB,
  job: Job<ReminderJob>,
  dependencies: { enqueue?: typeof enqueueCommunication } = {},
) {
  const rows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, job.data.reminderId));
  const reminder = rows[0];
  if (!reminder || reminder.status === "sent") return;
  if (!(await isModuleEnabled(reminder.salonId, MODULE_KEYS.REMINDERS, db))) {
    await db
      .update(reminders)
      .set({
        status: "failed",
        payload: {
          ...(reminder.payload as Record<string, unknown>),
          error: "MODULE_DISABLED",
        },
      })
      .where(eq(reminders.id, reminder.id));
    return;
  }
  const payload = reminder.payload as {
    customerId: string;
    customerName: string;
    email?: string | null;
    phone?: string | null;
    salonName: string;
    salonSlug: string;
    serviceName: string;
    staffName: string;
    startsAt: string | Date;
  };
  const startsAt = new Date(payload.startsAt);

  try {
    if (reminder.channel === "app") {
      await sendCustomerAppMessage(db, reminder.salonId, payload.customerId, {
        body: `Ti ricordiamo ${payload.serviceName} con ${payload.staffName} il ${startsAt.toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}.`,
        href: `/${payload.salonSlug}/appointments`,
        kind: "reminder",
        slug: payload.salonSlug,
        title: "Promemoria appuntamento",
      });
    } else if (reminder.channel === "whatsapp" && payload.phone) {
      await (dependencies.enqueue ?? enqueueCommunication)(db, {
        idempotencyKey: `appointment-reminder-${reminder.id}`,
        kind: "template",
        salonId: reminder.salonId,
        sourceId: reminder.id,
        sourceType: "reminder",
        template: {
          locale: "it",
          name: REMINDER_TEMPLATE,
          parameters: [
            payload.customerName,
            payload.serviceName,
            payload.salonName,
            startsAt.toLocaleDateString("it-IT"),
            startsAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
          ],
        },
        to: payload.phone,
      });
    } else if (reminder.channel === "email" && payload.email) {
      const pwaUrl = (process.env.PWA_URL ?? "http://localhost:3002").replace(/\/$/, "");
      await sendEmailFromDb(
        db,
        payload.email,
        `Promemoria appuntamento - ${payload.salonName}`,
        brandedEmailHtml({
          bodyHtml: `<p style="margin:0;">Ciao ${escapeHtml(payload.customerName)}, ti ricordiamo <strong style="color:#24161d;">${escapeHtml(payload.serviceName)}</strong> con ${escapeHtml(payload.staffName)} il <strong style="color:#24161d;">${escapeHtml(startsAt.toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" }))}</strong>.</p>`,
          ctaLabel: "Vedi i tuoi appuntamenti",
          ctaUrl: `${pwaUrl}/${payload.salonSlug}/appointments`,
          eyebrow: payload.salonName,
          footerNote: `Promemoria automatico inviato tramite EsseBeauty per conto di ${payload.salonName}.`,
          title: "Il tuo appuntamento si avvicina",
        }),
        { idempotencyKey: `appointment-reminder-${reminder.id}-email` },
      );
    } else {
      throw new Error("Missing reminder destination");
    }
    await db
      .update(reminders)
      .set({ status: "queued", sentAt: null })
      .where(eq(reminders.id, reminder.id));
  } catch (error) {
    await db
      .update(reminders)
      .set({
        status: "failed",
        payload: {
          ...payload,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .where(eq(reminders.id, reminder.id));
  }
}

export function startReminderWorker(db: DrizzleDB): Worker<ReminderJob> {
  return new Worker(
    QUEUE_NAMES.REMINDERS,
    async (job) => {
      if (job.name === "scan") {
        await scheduleDueReminders(db);
        return;
      }
      await processReminder(db, job);
    },
    { connection: redisConnection() },
  );
}

export async function registerReminderSchedule(): Promise<void> {
  // A reminder only fires once a scan actually runs after its scheduled time —
  // scanning every 5 minutes (with the 10-minute staleness window above) keeps a
  // reminder within ~5 minutes of "N hours before" instead of drifting toward the
  // old 15-minute scan interval's worst case.
  await getQueue(QUEUE_NAMES.REMINDERS).upsertJobScheduler(
    "scan-due-reminders",
    { every: 5 * 60_000 },
    { name: "scan" },
  );
}
