import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import {
  appointments,
  communicationConsents,
  customerCredentials,
  customers,
  customerSessions,
  loyaltyPoints,
  services,
  staff,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import { normalizePhoneE164 } from "../../lib/phone-normalization.js";
import { hashPassword } from "../auth/local-auth.js";

const viewGuard = [
  authenticate,
  requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
];
const editGuard = [
  authenticate,
  requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
];

function customerFullName(firstName: string, lastName: string) {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

export async function registerCustomerRoutes(app: FastifyInstance) {
  app.get<{
    Params: { id: string };
    Querystring: {
      page?: string;
      search?: string;
      tag?: string;
      blocked?: string;
    };
  }>("/api/salons/:id/customers", { preHandler: viewGuard }, async (request, reply) => {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const page = Math.max(1, Number(request.query.page) || 1);
    const search = request.query.search?.trim();
    const conditions = [
      eq(customers.salonId, request.salonId),
      ...(search
        ? [
            or(
              ilike(customers.fullName, `%${search}%`),
              ilike(customers.firstName, `%${search}%`),
              ilike(customers.lastName, `%${search}%`),
              ilike(customers.email, `%${search}%`),
              ilike(customers.phone, `%${search}%`),
            )!,
          ]
        : []),
      ...(request.query.tag
        ? [sql`${request.query.tag} = any(${customers.tags})`]
        : []),
      ...(request.query.blocked !== undefined
        ? [eq(customers.blocked, request.query.blocked === "true")]
        : []),
    ];
    const [rows, totalRows] = await Promise.all([
      app.db
        .select({
          id: customers.id,
          first_name: customers.firstName,
          last_name: customers.lastName,
          full_name: customers.fullName,
          email: customers.email,
          phone: customers.phone,
          tags: customers.tags,
          blocked: customers.blocked,
        })
        .from(customers)
        .where(and(...conditions))
        .orderBy(customers.fullName)
        .limit(20)
        .offset((page - 1) * 20),
      app.db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(...conditions)),
    ]);
    const customerIds = rows.map((row) => row.id);
    const [appointmentCounters, loyaltyCounters, accountRows] = customerIds.length
      ? await Promise.all([
          app.db
            .select({
              customer_id: appointments.customerId,
              last_visit: sql<Date | null>`max(${appointments.endsAt}) filter (
                where ${appointments.status} = 'completed' and ${appointments.endsAt} <= now()
              )`,
              total_appointments: sql<number>`count(*)::int`,
            })
            .from(appointments)
            .where(and(
              eq(appointments.salonId, request.salonId),
              inArray(appointments.customerId, customerIds),
            ))
            .groupBy(appointments.customerId),
          app.db
            .select({
              customer_id: loyaltyPoints.customerId,
              loyalty_points: sql<number>`coalesce(sum(${loyaltyPoints.delta}), 0)::int`,
            })
            .from(loyaltyPoints)
            .where(and(
              eq(loyaltyPoints.salonId, request.salonId),
              inArray(loyaltyPoints.customerId, customerIds),
              sql`${loyaltyPoints.expiredAt} is null`,
            ))
            .groupBy(loyaltyPoints.customerId),
          app.db
            .select({ customer_id: customerCredentials.customerId })
            .from(customerCredentials)
            .where(inArray(customerCredentials.customerId, customerIds)),
        ])
      : [[], [], []];
    const appointmentByCustomer = new Map(appointmentCounters.map((row) => [row.customer_id, row]));
    const loyaltyByCustomer = new Map(loyaltyCounters.map((row) => [row.customer_id, row]));
    const accountCustomerIds = new Set(accountRows.map((row) => row.customer_id));
    return {
      items: rows.map((row) => ({
        ...row,
        has_account: accountCustomerIds.has(row.id),
        last_visit: appointmentByCustomer.get(row.id)?.last_visit ?? null,
        loyalty_points: Number(loyaltyByCustomer.get(row.id)?.loyalty_points ?? 0),
        total_appointments: Number(appointmentByCustomer.get(row.id)?.total_appointments ?? 0),
      })),
      page,
      page_size: 20,
      total: Number(totalRows[0]?.count ?? 0),
    };
  });

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/customers/tags",
    { preHandler: viewGuard },
    async (request) => {
      const rows = await app.db.execute<{ tag: string }>(
        sql`select distinct unnest(tags) as tag from customers where salon_id = ${request.salonId} order by tag`,
      );
      return rows.map((row) => row.tag);
    },
  );

  app.get<{ Params: { id: string; customerId: string } }>(
    "/api/salons/:id/customers/:customerId",
    { preHandler: viewGuard },
    async (request, reply) => {
      const rows = await app.db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, request.params.customerId),
            eq(customers.salonId, request.salonId),
          ),
        );
      const customer = rows[0];
      if (!customer) {
        return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
      }
      const history = await app.db
        .select({
          id: appointments.id,
          starts_at: appointments.startsAt,
          status: appointments.status,
          service_name: services.name,
          staff_name: staff.displayName,
        })
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(staff, eq(staff.id, appointments.staffId))
        .where(eq(appointments.customerId, customer.id))
        .orderBy(desc(appointments.startsAt))
        .limit(20);
      const loyaltyEnabled = await isModuleEnabled(
        request.salonId,
        MODULE_KEYS.LOYALTY,
        app.db,
      );
      const points = loyaltyEnabled
        ? await app.db
            .select()
            .from(loyaltyPoints)
            .where(eq(loyaltyPoints.customerId, customer.id))
            .orderBy(desc(loyaltyPoints.createdAt))
        : [];
      const account = (await app.db
        .select({ id: customerCredentials.id })
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id)))[0];
      return {
        ...customer,
        appointments: history,
        hasAccount: Boolean(account),
        loyalty: loyaltyEnabled
          ? {
              balance: points.reduce((sum, item) => sum + item.delta, 0),
              history: points,
            }
          : null,
      };
    },
  );

  app.get<{ Params: { id: string; customerId: string } }>(
    "/api/salons/:id/customers/:customerId/communication-consents/whatsapp-marketing",
    { preHandler: editGuard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const customer = await app.db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, request.params.customerId), eq(customers.salonId, request.salonId)))
        .limit(1);
      if (!customer[0]) return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });

      const rows = await app.db
        .select()
        .from(communicationConsents)
        .where(and(
          eq(communicationConsents.salonId, request.salonId),
          eq(communicationConsents.customerId, request.params.customerId),
          eq(communicationConsents.channel, "whatsapp"),
          eq(communicationConsents.purpose, "marketing"),
        ))
        .limit(1);
      const consent = rows[0];
      const evidence = consent?.evidence ?? {};
      return {
        captured_at: consent?.capturedAt?.toISOString() ?? null,
        captured_source: consent?.capturedSource ?? null,
        evidence_note: typeof evidence.note === "string" ? evidence.note : null,
        history: Array.isArray(evidence.history) ? evidence.history : [],
        revoked_at: consent?.revokedAt?.toISOString() ?? null,
        status: consent?.status ?? "revoked",
      };
    },
  );

  app.put<{
    Params: { id: string; customerId: string };
    Body: { evidence_note?: string; source?: string; status?: "granted" | "revoked" };
  }>(
    "/api/salons/:id/customers/:customerId/communication-consents/whatsapp-marketing",
    { preHandler: editGuard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      if (request.body.status !== "granted" && request.body.status !== "revoked") {
        return reply.code(400).send({ error: "INVALID_CONSENT_STATUS" });
      }
      const customer = await app.db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, request.params.customerId), eq(customers.salonId, request.salonId)))
        .limit(1);
      if (!customer[0]) return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });

      const existingRows = await app.db
        .select()
        .from(communicationConsents)
        .where(and(
          eq(communicationConsents.salonId, request.salonId),
          eq(communicationConsents.customerId, request.params.customerId),
          eq(communicationConsents.channel, "whatsapp"),
          eq(communicationConsents.purpose, "marketing"),
        ))
        .limit(1);
      const existing = existingRows[0];
      const now = new Date();
      const previousEvidence = existing?.evidence ?? {};
      const previousHistory = Array.isArray(previousEvidence.history) ? previousEvidence.history : [];
      const evidenceNote = request.body.evidence_note?.trim() || null;
      const source = request.body.source?.trim() || "manual_admin";
      const history = existing && existing.status !== request.body.status
        ? [...previousHistory, {
            at: now.toISOString(),
            by_user_id: request.user.id,
            note: evidenceNote,
            source,
            status: request.body.status,
          }]
        : previousHistory;
      const evidence = { ...previousEvidence, history, note: evidenceNote };

      const rows = existing
        ? await app.db.update(communicationConsents).set({
            ...(request.body.status === "granted" && { capturedAt: now, capturedSource: source }),
            evidence,
            revokedAt: request.body.status === "revoked" ? now : null,
            status: request.body.status,
            updatedAt: now,
          }).where(and(
            eq(communicationConsents.id, existing.id),
            eq(communicationConsents.salonId, request.salonId),
          )).returning()
        : await app.db.insert(communicationConsents).values({
            capturedAt: now,
            capturedSource: source,
            channel: "whatsapp",
            customerId: request.params.customerId,
            evidence,
            purpose: "marketing",
            revokedAt: request.body.status === "revoked" ? now : null,
            salonId: request.salonId,
            status: request.body.status,
          }).returning();
      const consent = rows[0]!;
      return {
        captured_at: consent.capturedAt.toISOString(),
        captured_source: consent.capturedSource,
        evidence_note: evidenceNote,
        history,
        revoked_at: consent.revokedAt?.toISOString() ?? null,
        status: consent.status,
      };
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      full_name: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      notes?: string;
      tags?: string[];
    };
  }>("/api/salons/:id/customers", { preHandler: editGuard }, async (request, reply) => {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const email = request.body.email?.trim().toLowerCase() || undefined;
    const phone = request.body.phone?.trim() || undefined;
    const phoneNormalized = normalizePhoneE164(phone);
    const fullNameInput = request.body.full_name?.trim() ?? "";
    const firstName = request.body.first_name?.trim() || fullNameInput.split(/\s+/)[0] || "";
    const lastName = request.body.last_name?.trim() || fullNameInput.split(/\s+/).slice(1).join(" ");
    const fullName = customerFullName(firstName, lastName);
    if (!firstName || !lastName) {
      return reply.code(400).send({ error: "CUSTOMER_NAME_PARTS_REQUIRED" });
    }
    if (email || phoneNormalized) {
      const existing = await app.db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.salonId, request.salonId),
            or(
              ...(email ? [eq(customers.email, email)] : []),
              ...(phoneNormalized ? [eq(customers.phoneNormalized, phoneNormalized)] : []),
            )!,
          ),
        )
        .limit(1);
      if (existing[0]) {
        return reply.code(200).send(existing[0]);
      }
    }
    const rows = await app.db
      .insert(customers)
      .values({
        salonId: request.salonId,
        firstName,
        lastName,
        fullName,
        email,
        phone,
        phoneNormalized,
        notes: request.body.notes,
        tags: request.body.tags ?? [],
      })
      .returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{
    Params: { id: string; customerId: string };
    Body: Partial<{
      full_name: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      notes: string | null;
      tags: string[];
    }>;
  }>("/api/salons/:id/customers/:customerId", { preHandler: editGuard }, async (request, reply) => {
    const firstName = request.body.first_name?.trim();
    const lastName = request.body.last_name?.trim();
    const fullNameInput = request.body.full_name?.trim();
    const nextName = firstName !== undefined || lastName !== undefined
      ? {
          firstName,
          lastName,
          fullName: customerFullName(firstName ?? "", lastName ?? ""),
        }
      : fullNameInput !== undefined
        ? {
            firstName: fullNameInput.split(/\s+/)[0] || "",
            lastName: fullNameInput.split(/\s+/).slice(1).join(" "),
            fullName: fullNameInput,
          }
        : undefined;
    if (nextName && (!nextName.firstName || !nextName.lastName)) {
      return reply.code(400).send({ error: "CUSTOMER_NAME_PARTS_REQUIRED" });
    }
    const rows = await app.db
      .update(customers)
      .set({
        ...(nextName && nextName),
        ...(request.body.email !== undefined && { email: request.body.email }),
        ...(request.body.phone !== undefined && {
          phone: request.body.phone,
          phoneNormalized: normalizePhoneE164(request.body.phone),
        }),
        ...(request.body.notes !== undefined && { notes: request.body.notes }),
        ...(request.body.tags !== undefined && { tags: request.body.tags }),
      })
      .where(
        and(
          eq(customers.id, request.params.customerId),
          eq(customers.salonId, request.salonId),
        ),
      )
      .returning();
    return rows[0] ?? reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; customerId: string } }>(
    "/api/salons/:id/customers/:customerId",
    { preHandler: editGuard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const appointmentRows = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(
          and(
            eq(appointments.salonId, request.salonId),
            eq(appointments.customerId, request.params.customerId),
          ),
        );
      if (Number(appointmentRows[0]?.count ?? 0) > 0) {
        return reply.code(409).send({ error: "CUSTOMER_HAS_APPOINTMENTS" });
      }
      const rows = await app.db
        .delete(customers)
        .where(
          and(
            eq(customers.id, request.params.customerId),
            eq(customers.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
    },
  );

  app.patch<{
    Params: { id: string; customerId: string };
    Body: { blocked: boolean; reason?: string };
  }>(
    "/api/salons/:id/customers/:customerId/block",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_BLOCK),
      ],
    },
    async (request, reply) => {
      const rows = await app.db
        .update(customers)
        .set({
          blocked: request.body.blocked,
          ...(request.body.reason && {
            notes: sql`concat_ws(E'\n', ${customers.notes}, ${`Blocco: ${request.body.reason}`})`,
          }),
        })
        .where(
          and(
            eq(customers.id, request.params.customerId),
            eq(customers.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
    },
  );

  app.post<{
    Params: { id: string; customerId: string };
    Body: { new_password?: string };
  }>(
    "/api/salons/:id/customers/:customerId/reset-password",
    { preHandler: editGuard },
    async (request, reply) => {
      const password = request.body.new_password ?? "";
      if (password.length < 8) return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
      const customer = (await app.db.select({ id: customers.id }).from(customers)
        .where(and(eq(customers.id, request.params.customerId), eq(customers.salonId, request.salonId))))[0];
      if (!customer) return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
      const account = (await app.db.select({ id: customerCredentials.id }).from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id)))[0];
      if (!account) return reply.code(409).send({ error: "CUSTOMER_HAS_NO_ACCOUNT" });
      const hashed = await hashPassword(password);
      await app.db.transaction(async (tx) => {
        await tx.update(customerCredentials).set({
          passwordHash: hashed.hash,
          passwordSalt: hashed.salt,
          updatedAt: new Date(),
        }).where(eq(customerCredentials.customerId, customer.id));
        await tx.delete(customerSessions).where(eq(customerSessions.customerId, customer.id));
      });
      return { changed: true };
    },
  );

  app.get<{
    Params: { id: string; customerId: string };
    Querystring: { page?: string };
  }>(
    "/api/salons/:id/customers/:customerId/appointments",
    { preHandler: viewGuard },
    async (request) => {
      const page = Math.max(1, Number(request.query.page) || 1);
      return app.db
        .select({
          id: appointments.id,
          starts_at: appointments.startsAt,
          ends_at: appointments.endsAt,
          status: appointments.status,
          service_name: services.name,
          staff_name: staff.displayName,
        })
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(staff, eq(staff.id, appointments.staffId))
        .where(
          and(
            eq(appointments.salonId, request.salonId),
            eq(appointments.customerId, request.params.customerId),
          ),
        )
        .orderBy(desc(appointments.startsAt))
        .limit(20)
        .offset((page - 1) * 20);
    },
  );
}
