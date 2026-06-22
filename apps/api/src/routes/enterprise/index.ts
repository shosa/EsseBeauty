import type { FastifyInstance } from "fastify";
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

function ensureSalon(request: { params: { id: string }; salonId: string }, reply: { code(statusCode: number): { send(payload: unknown): unknown } }) {
  if (request.params.id !== request.salonId) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
  return undefined;
}

export async function registerEnterpriseModuleRoutes(app: FastifyInstance) {
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

  app.post<{
    Body: { active?: boolean; body: string; name: string; required_for_services?: string[]; type: string; version?: number };
    Params: { id: string };
  }>(
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
      if (!request.body.name?.trim() || !request.body.body?.trim()) {
        return reply.code(400).send({ error: "CONSENT_TEMPLATE_REQUIRED" });
      }
      const rows = await app.db
        .insert(consentTemplates)
        .values({
          active: request.body.active ?? true,
          body: request.body.body,
          name: request.body.name.trim(),
          requiredForServices: request.body.required_for_services ?? [],
          salonId: request.salonId,
          type: request.body.type,
          version: request.body.version ?? 1,
        })
        .returning();
      return reply.code(201).send(rows[0]);
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
      return app.db.select().from(customerConsents).where(and(...filters)).orderBy(desc(customerConsents.createdAt));
    },
  );

  app.post<{
    Body: { appointment_id?: string; customer_id: string; signature_data?: Record<string, unknown>; status?: "pending" | "signed" | "revoked" | "expired"; template_id: string };
    Params: { id: string };
  }>(
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
      const rows = await app.db
        .insert(customerConsents)
        .values({
          appointmentId: request.body.appointment_id,
          customerId: request.body.customer_id,
          signatureData: request.body.signature_data ?? {},
          signedAt: request.body.status === "signed" ? new Date() : undefined,
          salonId: request.salonId,
          status: request.body.status ?? "pending",
          templateId: request.body.template_id,
        })
        .returning();
      return reply.code(201).send(rows[0]);
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
