import { Worker, type Job } from "bullmq";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  reminderSettings,
  reminders,
  salons,
  services,
  staff,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";

import { fitSms, sendEmail, sendSms } from "./notifications.js";
import { getQueue, QUEUE_NAMES, redisConnection } from "./queues.js";

interface ReminderJob {
  reminderId: string;
}

type Characters<
  Value extends string,
  Result extends unknown[] = [],
> = Value extends `${infer _First}${infer Rest}`
  ? Characters<Rest, [...Result, unknown]>
  : Result;
type BuildTuple<
  Length extends number,
  Result extends unknown[] = [],
> = Result["length"] extends Length
  ? Result
  : BuildTuple<Length, [...Result, unknown]>;
type SmsTemplate<Value extends string> =
  Characters<Value> extends [...BuildTuple<161>, ...unknown[]] ? never : Value;

const SMS_TEMPLATE =
  "Hi {name}, reminder: {service} at {salon} on {date} at {time}." as const;
const checkedSmsTemplate: SmsTemplate<typeof SMS_TEMPLATE> = SMS_TEMPLATE;

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
        startsAt: appointments.startsAt,
        customerName: customers.fullName,
        email: customers.email,
        phone: customers.phone,
        salonName: salons.name,
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

    for (const item of rows) {
      for (const hours of setting.hoursBefore) {
        const scheduledAt = new Date(
          item.startsAt.getTime() - hours * 60 * 60_000,
        );
        if (scheduledAt > now || now.getTime() - scheduledAt.getTime() > 15 * 60_000) {
          continue;
        }
        const channels = [
          ...(setting.smsEnabled && item.phone ? ["sms" as const] : []),
          ...(setting.emailEnabled && item.email ? ["email" as const] : []),
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

async function processReminder(db: DrizzleDB, job: Job<ReminderJob>) {
  const rows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, job.data.reminderId));
  const reminder = rows[0];
  if (!reminder || reminder.status === "sent") return;
  const payload = reminder.payload as {
    customerName: string;
    email?: string | null;
    phone?: string | null;
    salonName: string;
    serviceName: string;
    staffName: string;
    startsAt: string | Date;
  };
  const startsAt = new Date(payload.startsAt);

  try {
    if (reminder.channel === "sms" && payload.phone) {
      await sendSms(
        payload.phone,
        fitSms(
          checkedSmsTemplate
            .replace("{name}", payload.customerName)
            .replace("{service}", payload.serviceName)
            .replace("{salon}", payload.salonName)
            .replace("{date}", startsAt.toLocaleDateString("it-IT"))
            .replace(
              "{time}",
              startsAt.toLocaleTimeString("it-IT", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            ),
        ),
      );
    } else if (reminder.channel === "email" && payload.email) {
      await sendEmail(
        payload.email,
        `Promemoria appuntamento - ${payload.salonName}`,
        `<h1>${payload.salonName}</h1><p>Ciao ${payload.customerName},</p><p>ti ricordiamo ${payload.serviceName} con ${payload.staffName} il ${startsAt.toLocaleString("it-IT")}.</p>`,
      );
    } else {
      throw new Error("Missing reminder destination");
    }
    await db
      .update(reminders)
      .set({ status: "sent", sentAt: new Date() })
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
  await getQueue(QUEUE_NAMES.REMINDERS).upsertJobScheduler(
    "scan-due-reminders",
    { every: 15 * 60_000 },
    { name: "scan" },
  );
}
