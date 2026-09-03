import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";

import { customerCredentials, customerPasswordResetTokens, customers, customerSessions, salons } from "@esse-beauty/db/schema";
import { normalizePhoneE164 } from "../../lib/phone-normalization.js";
import { inspectPublicToken, issuePublicToken } from "../../lib/public-tokens.js";
import {
  createCommunicationProviderRegistry,
  type CommunicationProviderRegistry,
} from "../../providers/communications.js";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../auth/local-auth.js";

export const CUSTOMER_SESSION_COOKIE = "esse-customer-session";
export const CUSTOMER_SESSION_DURATION_MS = 90 * 24 * 60 * 60_000;
const CUSTOMER_PASSWORD_RESET_DURATION_MS = 30 * 60_000;
const resetRequestResponse = {
  accepted: true,
  message: "Se l'indirizzo è registrato, riceverai un link per reimpostare la password.",
} as const;

interface CustomerAuthRouteDependencies {
  providers?: CommunicationProviderRegistry;
}

class CustomerResetTokenUnavailableError extends Error {}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function customerPayload(row: { email: string | null; firstName: string; fullName: string; id: string; lastName: string; phone: string | null }) {
  return {
    email: row.email,
    first_name: row.firstName,
    full_name: row.fullName,
    id: row.id,
    last_name: row.lastName,
    phone: row.phone,
  };
}

function setCustomerSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: CUSTOMER_SESSION_DURATION_MS / 1000,
    path: "/",
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE !== "false",
  });
}

function requestMetadata(request: FastifyRequest) {
  const userAgent = request.headers["user-agent"];
  return {
    ipAddress: request.ip?.slice(0, 128),
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
  };
}

async function createCustomerSession(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, salonId: string, customerId: string) {
  const token = createSessionToken();
  await app.db.insert(customerSessions).values({
    ...requestMetadata(request),
    customerId,
    expiresAt: new Date(Date.now() + CUSTOMER_SESSION_DURATION_MS),
    salonId,
    tokenHash: hashSessionToken(token),
  });
  setCustomerSessionCookie(reply, token);
}

export async function resolveCustomerId(app: FastifyInstance, request: FastifyRequest, salonId: string): Promise<string | undefined> {
  const token = request.cookies?.[CUSTOMER_SESSION_COOKIE];
  if (!token) return undefined;
  const rows = await app.db
    .select({ customerId: customerSessions.customerId, id: customerSessions.id, salonId: customerSessions.salonId })
    .from(customerSessions)
    .where(and(eq(customerSessions.tokenHash, hashSessionToken(token)), gt(customerSessions.expiresAt, new Date())));
  const session = rows[0];
  if (!session || session.salonId !== salonId) return undefined;
  void app.db.update(customerSessions).set({ lastSeenAt: new Date() }).where(eq(customerSessions.id, session.id));
  return session.customerId;
}

async function getSalon(app: FastifyInstance, slug: string) {
  const rows = await app.db.select().from(salons).where(eq(salons.slug, slug));
  return rows[0];
}

export async function registerPublicCustomerAuthRoutes(app: FastifyInstance, dependencies: CustomerAuthRouteDependencies = {}) {
  const providers = dependencies.providers ?? createCommunicationProviderRegistry();

  app.post<{
    Body: { email?: string; first_name?: string; last_name?: string; password?: string; phone?: string };
    Params: { slug: string };
  }>("/api/public/:slug/customer-auth/register", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });

    const firstName = request.body.first_name?.trim() ?? "";
    const lastName = request.body.last_name?.trim() ?? "";
    const password = request.body.password ?? "";
    const phoneNormalized = normalizePhoneE164(request.body.phone);
    if (!phoneNormalized) return reply.code(400).send({ error: "PHONE_INVALID" });
    if (!firstName || !lastName) return reply.code(400).send({ error: "CUSTOMER_NAME_PARTS_REQUIRED" });
    if (password.length < 8) return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });

    const existingCredentials = (await app.db.select({ id: customerCredentials.id }).from(customerCredentials)
      .where(and(eq(customerCredentials.salonId, salon.id), eq(customerCredentials.phoneNormalized, phoneNormalized))))[0];
    if (existingCredentials) return reply.code(409).send({ error: "PHONE_ALREADY_REGISTERED" });

    const existingCustomer = (await app.db.select().from(customers)
      .where(and(eq(customers.salonId, salon.id), eq(customers.phoneNormalized, phoneNormalized))))[0];
    if (existingCustomer?.blocked) return reply.code(403).send({ error: "CUSTOMER_BLOCKED" });

    const customer = existingCustomer ?? (await app.db.insert(customers).values({
      email: request.body.email?.trim() || undefined,
      firstName,
      fullName: [firstName, lastName].filter(Boolean).join(" "),
      lastName,
      phone: request.body.phone?.trim(),
      phoneNormalized,
      salonId: salon.id,
    }).returning())[0]!;

    const { hash, salt } = await hashPassword(password);
    await app.db.insert(customerCredentials).values({
      customerId: customer.id,
      passwordHash: hash,
      passwordSalt: salt,
      phoneNormalized,
      salonId: salon.id,
    });

    await createCustomerSession(app, request, reply, salon.id, customer.id);
    return reply.code(201).send(customerPayload(customer));
  });

  app.post<{ Body: { password?: string; phone?: string }; Params: { slug: string } }>(
    "/api/public/:slug/customer-auth/login", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });

      const phoneNormalized = normalizePhoneE164(request.body.phone);
      const password = request.body.password ?? "";
      const rows = phoneNormalized
        ? await app.db.select({
          customer: customers,
          passwordHash: customerCredentials.passwordHash,
          passwordSalt: customerCredentials.passwordSalt,
        }).from(customerCredentials)
          .innerJoin(customers, eq(customers.id, customerCredentials.customerId))
          .where(and(eq(customerCredentials.salonId, salon.id), eq(customerCredentials.phoneNormalized, phoneNormalized)))
        : [];
      const row = rows[0];
      const passwordMatches = row ? await verifyPassword(password, row.passwordSalt, row.passwordHash) : false;
      if (!row || !passwordMatches) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      if (row.customer.blocked) return reply.code(403).send({ error: "CUSTOMER_BLOCKED" });

      await createCustomerSession(app, request, reply, salon.id, row.customer.id);
      return customerPayload(row.customer);
    });

  app.post<{ Params: { slug: string } }>("/api/public/:slug/customer-auth/logout", async (request, reply) => {
    const token = request.cookies?.[CUSTOMER_SESSION_COOKIE];
    if (token) await app.db.delete(customerSessions).where(eq(customerSessions.tokenHash, hashSessionToken(token)));
    reply.setCookie(CUSTOMER_SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/", sameSite: "lax" });
    return { ok: true };
  });

  app.post<{ Body: { email?: string }; Params: { slug: string } }>(
    "/api/public/:slug/customer-auth/password-reset/request", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      const email = request.body.email?.trim();
      if (!email) return reply.code(400).send({ error: "EMAIL_REQUIRED" });

      // Provider readiness is checked before account lookup so this response cannot
      // disclose whether an address belongs to a registered account.
      if (providers.status().email !== "ready") {
        return reply.code(503).send({ error: "PROVIDER_NOT_CONFIGURED" });
      }

      const row = (await app.db.select({ customer: customers })
        .from(customerCredentials)
        .innerJoin(customers, eq(customers.id, customerCredentials.customerId))
        .where(and(eq(customerCredentials.salonId, salon.id), eq(customers.email, email))))[0];

      if (row && !row.customer.blocked) {
        const expiresAt = new Date(Date.now() + CUSTOMER_PASSWORD_RESET_DURATION_MS);
        const token = issuePublicToken("customer_pwd_reset", row.customer.id, expiresAt);
        const tokenId = randomUUID();
        await app.db.transaction(async (tx) => {
          await tx.update(customerPasswordResetTokens)
            .set({ usedAt: new Date() })
            .where(and(eq(customerPasswordResetTokens.customerId, row.customer.id), isNull(customerPasswordResetTokens.usedAt)));
          await tx.insert(customerPasswordResetTokens).values({
            customerId: row.customer.id,
            expiresAt,
            id: tokenId,
            salonId: salon.id,
            tokenHash: token.tokenHash,
          });
        });

        const baseUrl = (process.env.PWA_URL ?? "http://localhost:3002").replace(/\/$/, "");
        const resetUrl = `${baseUrl}/${salon.slug}/reset-password/${token.raw}`;
        try {
          await providers.send({
            channel: "email",
            html: `<p>Hai richiesto di reimpostare la password per il tuo account ${escapeHtml(salon.name)}.</p><p><a href="${escapeHtml(resetUrl)}">Scegli una nuova password</a></p><p>Il link scade tra 30 minuti e può essere utilizzato una sola volta.</p>`,
            idempotencyKey: `customer-password-reset:${tokenId}`,
            subject: "Reimposta la tua password",
            to: email,
          });
        } catch (error) {
          await app.db.update(customerPasswordResetTokens)
            .set({ usedAt: new Date() })
            .where(eq(customerPasswordResetTokens.id, tokenId));
          request.log.warn({ error: error instanceof Error ? error.name : "ProviderError", tokenId }, "Customer password reset delivery failed");
        }
      }

      return reply.code(202).send(resetRequestResponse);
    });

  app.post<{ Body: { new_password?: string; token?: string }; Params: { slug: string } }>(
    "/api/public/:slug/customer-auth/password-reset/complete", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      const password = request.body.new_password ?? "";
      const token = request.body.token ?? "";
      if (password.length < 8) return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
      const inspected = inspectPublicToken(token, "customer_pwd_reset");
      if (!inspected.ok || inspected.expired) return reply.code(410).send({ error: "RESET_TOKEN_INVALID_OR_EXPIRED" });

      const hashed = await hashPassword(password);
      try {
        await app.db.transaction(async (tx) => {
          const consumed = await tx.update(customerPasswordResetTokens)
            .set({ usedAt: new Date() })
            .where(and(
              eq(customerPasswordResetTokens.tokenHash, inspected.tokenHash),
              eq(customerPasswordResetTokens.salonId, salon.id),
              isNull(customerPasswordResetTokens.usedAt),
              gt(customerPasswordResetTokens.expiresAt, new Date()),
            ))
            .returning({ customerId: customerPasswordResetTokens.customerId });
          const reset = consumed[0];
          if (!reset) throw new CustomerResetTokenUnavailableError();
          await tx.update(customerCredentials).set({
            passwordHash: hashed.hash,
            passwordSalt: hashed.salt,
            updatedAt: new Date(),
          }).where(eq(customerCredentials.customerId, reset.customerId));
          await tx.delete(customerSessions).where(eq(customerSessions.customerId, reset.customerId));
        });
      } catch (error) {
        if (error instanceof CustomerResetTokenUnavailableError) {
          return reply.code(410).send({ error: "RESET_TOKEN_INVALID_OR_EXPIRED" });
        }
        throw error;
      }
      return { changed: true };
    });

  app.get<{ Params: { slug: string } }>("/api/public/:slug/customer-auth/me", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const customerId = await resolveCustomerId(app, request, salon.id);
    if (!customerId) return reply.code(401).send({ error: "UNAUTHORIZED" });
    const customer = (await app.db.select().from(customers).where(eq(customers.id, customerId)))[0];
    if (!customer) return reply.code(401).send({ error: "UNAUTHORIZED" });
    return customerPayload(customer);
  });
}
