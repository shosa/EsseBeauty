import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  consentTemplates,
  customerConsents,
  customers,
  salons,
  services,
  users,
} from "@esse-beauty/db/schema";

import { inspectPublicToken, issuePublicToken } from "./public-tokens.js";

export type ConsentDeliveryChannel = "email" | "in_person" | "sms";
export type ConsentStatus = "expired" | "pending" | "revoked" | "signed";
export type ConsentSignature = {
  type: "drawn" | "typed";
  value: string;
};

export interface ConsentTemplateRecord {
  active: boolean;
  body: string;
  createdAt: Date;
  id: string;
  name: string;
  requiredForServices: string[];
  salonId: string;
  type: string;
  updatedAt: Date;
  version: number;
}

export interface ConsentRequestRecord {
  appointmentId: string | null;
  createdAt: Date;
  customerId: string;
  deliveryChannel: ConsentDeliveryChannel | null;
  documentHash: string | null;
  expiresAt: Date | null;
  id: string;
  ipAddress: string | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  salonId: string;
  signatureData: Record<string, unknown>;
  signedAt: Date | null;
  signerName: string | null;
  status: ConsentStatus;
  templateId: string;
  tokenHash: string | null;
  userAgent: string | null;
}

export interface ConsentRequestWithDocument extends ConsentRequestRecord {
  salonName: string;
  templateBody: string;
  templateName: string;
  templateType: string;
  templateVersion: number;
}

interface InsertTemplateInput {
  active: boolean;
  body: string;
  name: string;
  requiredForServices: string[];
  salonId: string;
  type: string;
  version: number;
}

interface InsertConsentInput {
  appointmentId: string | null;
  customerId: string;
  deliveryChannel: ConsentDeliveryChannel;
  expiresAt: Date;
  id: string;
  salonId: string;
  status: "pending";
  templateId: string;
  tokenHash: string;
}

interface ConsentUpdate {
  deliveryChannel?: ConsentDeliveryChannel;
  documentHash?: string;
  expiresAt?: Date;
  ipAddress?: string | null;
  revokedAt?: Date;
  revokedByUserId?: string;
  revocationReason?: string;
  signatureData?: Record<string, unknown>;
  signedAt?: Date;
  signerName?: string;
  status?: ConsentStatus;
  tokenHash?: string;
  userAgent?: string | null;
}

export interface ConsentLifecycleTransaction {
  appointmentBelongsToSalon(input: {
    appointmentId: string;
    customerId: string;
    salonId: string;
  }): Promise<boolean>;
  archiveTemplate(salonId: string, templateId: string): Promise<ConsentTemplateRecord | undefined>;
  customerBelongsToSalon(salonId: string, customerId: string): Promise<boolean>;
  expireDueConsents(salonId: string): Promise<number>;
  findConsentById(salonId: string, consentId: string): Promise<ConsentRequestWithDocument | undefined>;
  findConsentByTokenHash(tokenHash: string): Promise<ConsentRequestWithDocument | undefined>;
  findTemplate(salonId: string, templateId: string): Promise<ConsentTemplateRecord | undefined>;
  insertConsent(input: InsertConsentInput): Promise<ConsentRequestRecord>;
  insertTemplate(input: InsertTemplateInput): Promise<ConsentTemplateRecord>;
  latestTemplateVersion(salonId: string, name: string): Promise<number>;
  lockTemplateName(salonId: string, name: string): Promise<void>;
  servicesBelongToSalon(salonId: string, serviceIds: string[]): Promise<boolean>;
  updateConsent(
    salonId: string,
    consentId: string,
    changes: ConsentUpdate,
  ): Promise<ConsentRequestRecord | undefined>;
  userBelongsToSalon(salonId: string, userId: string): Promise<boolean>;
}

export interface ConsentLifecycleRepository {
  transaction<T>(work: (tx: ConsentLifecycleTransaction) => Promise<T>): Promise<T>;
}

export type ConsentLifecycleErrorCode =
  | "CONSENT_ALREADY_REVOKED"
  | "CONSENT_APPOINTMENT_INVALID"
  | "CONSENT_CUSTOMER_INVALID"
  | "CONSENT_EVIDENCE_TAMPERED"
  | "CONSENT_NOT_SIGNED"
  | "CONSENT_REQUEST_NOT_FOUND"
  | "CONSENT_REVOKER_INVALID"
  | "CONSENT_SERVICE_INVALID"
  | "CONSENT_TEMPLATE_ARCHIVED"
  | "CONSENT_TEMPLATE_NOT_FOUND"
  | "CONSENT_TEMPLATE_VERSION_CONFLICT"
  | "TOKEN_CONSUMED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "TOKEN_REVOKED";

const errorStatus: Record<ConsentLifecycleErrorCode, number> = {
  CONSENT_ALREADY_REVOKED: 409,
  CONSENT_APPOINTMENT_INVALID: 400,
  CONSENT_CUSTOMER_INVALID: 400,
  CONSENT_EVIDENCE_TAMPERED: 409,
  CONSENT_NOT_SIGNED: 409,
  CONSENT_REQUEST_NOT_FOUND: 404,
  CONSENT_REVOKER_INVALID: 403,
  CONSENT_SERVICE_INVALID: 400,
  CONSENT_TEMPLATE_ARCHIVED: 409,
  CONSENT_TEMPLATE_NOT_FOUND: 404,
  CONSENT_TEMPLATE_VERSION_CONFLICT: 409,
  TOKEN_CONSUMED: 409,
  TOKEN_EXPIRED: 410,
  TOKEN_INVALID: 404,
  TOKEN_REVOKED: 410,
};

export class ConsentLifecycleError extends Error {
  readonly code: ConsentLifecycleErrorCode;
  readonly statusCode: number;

  constructor(code: ConsentLifecycleErrorCode) {
    super(code);
    this.name = "ConsentLifecycleError";
    this.code = code;
    this.statusCode = errorStatus[code];
  }
}

function fail(code: ConsentLifecycleErrorCode): never {
  throw new ConsentLifecycleError(code);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function databaseErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return undefined;
    const record = current as { cause?: unknown; code?: unknown };
    if (typeof record.code === "string") return record.code;
    current = record.cause;
  }
  return undefined;
}

async function allocateTemplateVersion(
  work: () => Promise<ConsentTemplateRecord>,
): Promise<ConsentTemplateRecord> {
  try {
    return await work();
  } catch (error) {
    if (databaseErrorCode(error) === "23505") {
      fail("CONSENT_TEMPLATE_VERSION_CONFLICT");
    }
    throw error;
  }
}

async function assertServices(
  tx: ConsentLifecycleTransaction,
  salonId: string,
  serviceIds: string[],
): Promise<string[]> {
  const normalized = unique(serviceIds);
  if (!(await tx.servicesBelongToSalon(salonId, normalized))) {
    fail("CONSENT_SERVICE_INVALID");
  }
  return normalized;
}

export async function createConsentTemplate(
  repository: ConsentLifecycleRepository,
  input: {
    active?: boolean;
    body: string;
    name: string;
    requiredForServices?: string[];
    salonId: string;
    type: string;
  },
): Promise<ConsentTemplateRecord> {
  return allocateTemplateVersion(() => repository.transaction(async (tx) => {
    const requiredForServices = await assertServices(
      tx,
      input.salonId,
      input.requiredForServices ?? [],
    );
    await tx.lockTemplateName(input.salonId, input.name);
    const latest = await tx.latestTemplateVersion(input.salonId, input.name);
    return tx.insertTemplate({
      active: input.active ?? true,
      body: input.body,
      name: input.name,
      requiredForServices,
      salonId: input.salonId,
      type: input.type,
      version: latest + 1,
    });
  }));
}

export async function versionTemplate(
  repository: ConsentLifecycleRepository,
  templateId: string,
  input: {
    active?: boolean;
    body: string;
    name?: string;
    requiredForServices?: string[];
    salonId: string;
    type?: string;
  },
): Promise<ConsentTemplateRecord> {
  return allocateTemplateVersion(() => repository.transaction(async (tx) => {
    const current = await tx.findTemplate(input.salonId, templateId);
    if (!current) fail("CONSENT_TEMPLATE_NOT_FOUND");
    const requiredForServices = await assertServices(
      tx,
      input.salonId,
      input.requiredForServices ?? current.requiredForServices,
    );
    const name = input.name ?? current.name;
    await tx.lockTemplateName(input.salonId, name);
    const latest = await tx.latestTemplateVersion(input.salonId, name);
    return tx.insertTemplate({
      active: input.active ?? true,
      body: input.body,
      name,
      requiredForServices,
      salonId: input.salonId,
      type: input.type ?? current.type,
      version: latest + 1,
    });
  }));
}

export async function archiveConsentTemplate(
  repository: ConsentLifecycleRepository,
  salonId: string,
  templateId: string,
): Promise<ConsentTemplateRecord> {
  return repository.transaction(async (tx) => {
    const archived = await tx.archiveTemplate(salonId, templateId);
    if (!archived) fail("CONSENT_TEMPLATE_NOT_FOUND");
    return archived;
  });
}

export async function createConsentRequest(
  repository: ConsentLifecycleRepository,
  input: {
    appointmentId?: string | null;
    customerId: string;
    deliveryChannel: ConsentDeliveryChannel;
    expiresAt: Date;
    salonId: string;
    templateId: string;
  },
): Promise<{ consent: ConsentRequestRecord; rawToken: string }> {
  return repository.transaction(async (tx) => {
    if (!(await tx.customerBelongsToSalon(input.salonId, input.customerId))) {
      fail("CONSENT_CUSTOMER_INVALID");
    }
    const templateRecord = await tx.findTemplate(input.salonId, input.templateId);
    if (!templateRecord) fail("CONSENT_TEMPLATE_NOT_FOUND");
    if (!templateRecord.active) fail("CONSENT_TEMPLATE_ARCHIVED");
    await assertServices(tx, input.salonId, templateRecord.requiredForServices);
    if (input.appointmentId && !(await tx.appointmentBelongsToSalon({
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      salonId: input.salonId,
    }))) {
      fail("CONSENT_APPOINTMENT_INVALID");
    }

    const id = randomUUID();
    const token = issuePublicToken("consent", id, input.expiresAt);
    const consentRecord = await tx.insertConsent({
      appointmentId: input.appointmentId ?? null,
      customerId: input.customerId,
      deliveryChannel: input.deliveryChannel,
      expiresAt: input.expiresAt,
      id,
      salonId: input.salonId,
      status: "pending",
      templateId: input.templateId,
      tokenHash: token.tokenHash,
    });
    return { consent: consentRecord, rawToken: token.raw };
  });
}

export async function resendConsentRequest(
  repository: ConsentLifecycleRepository,
  consentId: string,
  input: {
    deliveryChannel: ConsentDeliveryChannel;
    expiresAt: Date;
    salonId: string;
  },
): Promise<{ consent: ConsentRequestRecord; rawToken: string }> {
  return repository.transaction(async (tx) => {
    const current = await tx.findConsentById(input.salonId, consentId);
    if (!current) fail("CONSENT_REQUEST_NOT_FOUND");
    if (current.status === "signed") fail("TOKEN_CONSUMED");
    if (current.status === "revoked") fail("TOKEN_REVOKED");
    const token = issuePublicToken("consent", current.id, input.expiresAt);
    const updated = await tx.updateConsent(input.salonId, consentId, {
      deliveryChannel: input.deliveryChannel,
      expiresAt: input.expiresAt,
      status: "pending",
      tokenHash: token.tokenHash,
    });
    if (!updated) fail("CONSENT_REQUEST_NOT_FOUND");
    return { consent: updated, rawToken: token.raw };
  });
}

export async function expireDueConsentRequests(
  repository: ConsentLifecycleRepository,
  salonId: string,
): Promise<number> {
  return repository.transaction((tx) => tx.expireDueConsents(salonId));
}

interface CanonicalConsentDocument {
  body: string;
  name: string;
  templateId: string;
  type: string;
  version: number;
}

function documentFor(consentRecord: ConsentRequestWithDocument): CanonicalConsentDocument {
  return {
    body: consentRecord.templateBody,
    name: consentRecord.templateName,
    templateId: consentRecord.templateId,
    type: consentRecord.templateType,
    version: consentRecord.templateVersion,
  };
}

function canonicalDocument(document: CanonicalConsentDocument): string {
  return JSON.stringify({
    body: document.body,
    name: document.name,
    templateId: document.templateId,
    type: document.type,
    version: document.version,
  });
}

function hashDocument(document: CanonicalConsentDocument): string {
  return createHash("sha256")
    .update(canonicalDocument(document))
    .digest("hex");
}

async function signabilityError(
  tx: ConsentLifecycleTransaction,
  consentRecord: ConsentRequestWithDocument,
  publicToken: boolean,
  embeddedExpiryPassed: boolean,
): Promise<ConsentLifecycleErrorCode | undefined> {
  if (consentRecord.status === "signed") {
    return publicToken ? "TOKEN_CONSUMED" : "CONSENT_NOT_SIGNED";
  }
  if (consentRecord.status === "revoked") return "TOKEN_REVOKED";
  if (
    embeddedExpiryPassed ||
    consentRecord.status === "expired" ||
    !consentRecord.expiresAt ||
    consentRecord.expiresAt.getTime() <= Date.now()
  ) {
    if (consentRecord.status === "pending") {
      await tx.updateConsent(consentRecord.salonId, consentRecord.id, {
        status: "expired",
      });
    }
    return "TOKEN_EXPIRED";
  }
  return undefined;
}

export async function resolveConsent(
  repository: ConsentLifecycleRepository,
  rawToken: string,
): Promise<ConsentRequestWithDocument> {
  const inspected = inspectPublicToken(rawToken, "consent");
  if (!inspected.ok) fail("TOKEN_INVALID");
  const result = await repository.transaction(async (tx) => {
    const current = await tx.findConsentByTokenHash(inspected.tokenHash);
    if (!current) fail("TOKEN_INVALID");
    const error = await signabilityError(tx, current, true, inspected.expired);
    return error ? { error } as const : { consent: current } as const;
  });
  if ("error" in result && result.error) fail(result.error);
  return result.consent;
}

export async function signConsent(
  repository: ConsentLifecycleRepository,
  locator: string | { consentId: string; salonId: string; signedByUserId: string },
  input: {
    accepted: true;
    signature: ConsentSignature;
    signerName: string;
  },
  metadata: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<ConsentRequestRecord> {
  const publicToken = typeof locator === "string";
  const inspected = publicToken ? inspectPublicToken(locator, "consent") : undefined;
  if (inspected && !inspected.ok) fail("TOKEN_INVALID");

  const result = await repository.transaction(async (tx) => {
    let current: ConsentRequestWithDocument | undefined;
    let source: "in_person" | "public";
    let signedByUserId: string | undefined;
    if (typeof locator === "string") {
      current = await tx.findConsentByTokenHash(inspected && inspected.ok ? inspected.tokenHash : "");
      source = "public";
    } else {
      if (!(await tx.userBelongsToSalon(locator.salonId, locator.signedByUserId))) {
        fail("CONSENT_REVOKER_INVALID");
      }
      current = await tx.findConsentById(locator.salonId, locator.consentId);
      source = "in_person";
      signedByUserId = locator.signedByUserId;
    }
    if (!current) fail(publicToken ? "TOKEN_INVALID" : "CONSENT_REQUEST_NOT_FOUND");
    const error = await signabilityError(
      tx,
      current,
      publicToken,
      Boolean(inspected?.ok && inspected.expired),
    );
    if (error) return { error } as const;

    const signedAt = new Date();
    const document = documentFor(current);
    const documentHash = hashDocument(document);
    const updated = await tx.updateConsent(current.salonId, current.id, {
      documentHash,
      ipAddress: metadata.ipAddress ?? null,
      signatureData: {
        accepted: input.accepted,
        document,
        signature: input.signature,
        signedAt: signedAt.toISOString(),
        signedByUserId,
        source,
      },
      signedAt,
      signerName: input.signerName,
      status: "signed",
      userAgent: metadata.userAgent ?? null,
    });
    if (!updated) fail("CONSENT_REQUEST_NOT_FOUND");
    return { consent: updated } as const;
  });
  if ("error" in result && result.error) fail(result.error);
  return result.consent;
}

export async function revokeConsent(
  repository: ConsentLifecycleRepository,
  consentId: string,
  input: { reason: string; revokedByUserId: string; salonId: string },
): Promise<ConsentRequestRecord> {
  return repository.transaction(async (tx) => {
    if (!(await tx.userBelongsToSalon(input.salonId, input.revokedByUserId))) {
      fail("CONSENT_REVOKER_INVALID");
    }
    const current = await tx.findConsentById(input.salonId, consentId);
    if (!current) fail("CONSENT_REQUEST_NOT_FOUND");
    if (current.status === "revoked") fail("CONSENT_ALREADY_REVOKED");
    if (current.status !== "signed") fail("CONSENT_NOT_SIGNED");
    const updated = await tx.updateConsent(input.salonId, consentId, {
      revokedAt: new Date(),
      revokedByUserId: input.revokedByUserId,
      revocationReason: input.reason,
      status: "revoked",
    });
    if (!updated) fail("CONSENT_REQUEST_NOT_FOUND");
    return updated;
  });
}

function evidenceDocument(record: ConsentRequestWithDocument): CanonicalConsentDocument {
  const stored = record.signatureData.document;
  const hasStoredDocument = Object.prototype.hasOwnProperty.call(
    record.signatureData,
    "document",
  );
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const document = stored as Record<string, unknown>;
    if (
      typeof document.body === "string" &&
      typeof document.name === "string" &&
      typeof document.templateId === "string" &&
      typeof document.type === "string" &&
      typeof document.version === "number"
    ) {
      return {
        body: document.body,
        name: document.name,
        templateId: document.templateId,
        type: document.type,
        version: document.version,
      };
    }
    fail("CONSENT_EVIDENCE_TAMPERED");
  }
  if (hasStoredDocument) fail("CONSENT_EVIDENCE_TAMPERED");
  return documentFor(record);
}

export async function renderConsentEvidence(
  repository: ConsentLifecycleRepository,
  consentId: string,
  input: { salonId: string },
): Promise<{
  content: string;
  contentType: "text/plain; charset=utf-8";
  documentHash: string;
  filename: string;
}> {
  return repository.transaction(async (tx) => {
    const record = await tx.findConsentById(input.salonId, consentId);
    if (!record) fail("CONSENT_REQUEST_NOT_FOUND");
    if (!record.signedAt || !record.signerName || !record.documentHash) {
      fail("CONSENT_NOT_SIGNED");
    }
    const document = evidenceDocument(record);
    const canonical = canonicalDocument(document);
    if (hashDocument(document) !== record.documentHash) {
      fail("CONSENT_EVIDENCE_TAMPERED");
    }
    const lines = [
      "REGISTRO DEL CONSENSO",
      `Salone: ${record.salonName}`,
      `Documento: ${String(document.name)}`,
      `Versione: ${String(document.version)}`,
      `Template ID: ${document.templateId}`,
      `Tipo: ${document.type}`,
      `Stato: ${record.status}`,
      `Firmatario: ${record.signerName}`,
      `Accettato il: ${record.signedAt.toISOString()}`,
      `Hash documento (SHA-256): ${record.documentHash}`,
      `Input SHA-256: ${canonical}`,
      "",
      "TESTO ACCETTATO",
      String(document.body),
    ];
    if (record.revokedAt) {
      lines.push(
        "",
        "REVOCA",
        `Revocato il: ${record.revokedAt.toISOString()}`,
        `Motivo: ${record.revocationReason ?? "Non specificato"}`,
      );
    }
    return {
      content: `${lines.join("\n")}\n`,
      contentType: "text/plain; charset=utf-8",
      documentHash: record.documentHash,
      filename: `consenso-${record.id}.txt`,
    };
  });
}

const consentDocumentSelection = {
  appointmentId: customerConsents.appointmentId,
  createdAt: customerConsents.createdAt,
  customerId: customerConsents.customerId,
  deliveryChannel: customerConsents.deliveryChannel,
  documentHash: customerConsents.documentHash,
  expiresAt: customerConsents.expiresAt,
  id: customerConsents.id,
  ipAddress: customerConsents.ipAddress,
  revokedAt: customerConsents.revokedAt,
  revokedByUserId: customerConsents.revokedByUserId,
  revocationReason: customerConsents.revocationReason,
  salonId: customerConsents.salonId,
  salonName: salons.name,
  signatureData: customerConsents.signatureData,
  signedAt: customerConsents.signedAt,
  signerName: customerConsents.signerName,
  status: customerConsents.status,
  templateBody: consentTemplates.body,
  templateId: customerConsents.templateId,
  templateName: consentTemplates.name,
  templateType: consentTemplates.type,
  templateVersion: consentTemplates.version,
  tokenHash: customerConsents.tokenHash,
  userAgent: customerConsents.userAgent,
};

function drizzleTransaction(executor: DrizzleDB): ConsentLifecycleTransaction {
  async function findConsent(where: SQL) {
    const rows = await executor
      .select(consentDocumentSelection)
      .from(customerConsents)
      .innerJoin(consentTemplates, eq(consentTemplates.id, customerConsents.templateId))
      .innerJoin(salons, eq(salons.id, customerConsents.salonId))
      .where(where)
      .for("update");
    return rows[0] as ConsentRequestWithDocument | undefined;
  }

  return {
    async appointmentBelongsToSalon({ appointmentId, customerId, salonId }) {
      const rows = await executor
        .select({ id: appointments.id })
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .where(and(
          eq(appointments.id, appointmentId),
          eq(appointments.customerId, customerId),
          eq(appointments.salonId, salonId),
          eq(services.salonId, salonId),
        ));
      return Boolean(rows[0]);
    },
    async archiveTemplate(salonId, templateId) {
      const rows = await executor
        .update(consentTemplates)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(consentTemplates.id, templateId), eq(consentTemplates.salonId, salonId)))
        .returning();
      return rows[0] as ConsentTemplateRecord | undefined;
    },
    async customerBelongsToSalon(salonId, customerId) {
      const rows = await executor
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.salonId, salonId)));
      return Boolean(rows[0]);
    },
    async expireDueConsents(salonId) {
      const rows = await executor
        .update(customerConsents)
        .set({ status: "expired" })
        .where(and(
          eq(customerConsents.salonId, salonId),
          eq(customerConsents.status, "pending"),
          isNotNull(customerConsents.expiresAt),
          lte(customerConsents.expiresAt, new Date()),
        ))
        .returning({ id: customerConsents.id });
      return rows.length;
    },
    findConsentById(salonId, consentId) {
      return findConsent(and(
        eq(customerConsents.id, consentId),
        eq(customerConsents.salonId, salonId),
      )!);
    },
    findConsentByTokenHash(tokenHash) {
      return findConsent(eq(customerConsents.tokenHash, tokenHash));
    },
    async findTemplate(salonId, templateId) {
      const rows = await executor
        .select()
        .from(consentTemplates)
        .where(and(eq(consentTemplates.id, templateId), eq(consentTemplates.salonId, salonId)))
        .for("update");
      return rows[0] as ConsentTemplateRecord | undefined;
    },
    async insertConsent(input) {
      const rows = await executor.insert(customerConsents).values(input).returning();
      return rows[0] as ConsentRequestRecord;
    },
    async insertTemplate(input) {
      const rows = await executor.insert(consentTemplates).values(input).returning();
      return rows[0] as ConsentTemplateRecord;
    },
    async latestTemplateVersion(salonId, name) {
      const rows = await executor
        .select({ version: sql<number>`coalesce(max(${consentTemplates.version}), 0)` })
        .from(consentTemplates)
        .where(and(eq(consentTemplates.salonId, salonId), eq(consentTemplates.name, name)));
      return Number(rows[0]?.version ?? 0);
    },
    async lockTemplateName(salonId, name) {
      await executor.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(${`${salonId}:${name}`}, 0)
        )
      `);
    },
    async servicesBelongToSalon(salonId, serviceIds) {
      if (serviceIds.length === 0) return true;
      const rows = await executor
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.salonId, salonId), inArray(services.id, unique(serviceIds))));
      return rows.length === unique(serviceIds).length;
    },
    async updateConsent(salonId, consentId, changes) {
      const rows = await executor
        .update(customerConsents)
        .set(changes)
        .where(and(eq(customerConsents.id, consentId), eq(customerConsents.salonId, salonId)))
        .returning();
      return rows[0] as ConsentRequestRecord | undefined;
    },
    async userBelongsToSalon(salonId, userId) {
      const rows = await executor
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.salonId, salonId), eq(users.active, true)));
      return Boolean(rows[0]);
    },
  };
}

export function createDrizzleConsentRepository(db: DrizzleDB): ConsentLifecycleRepository {
  return {
    transaction(work) {
      return db.transaction((tx) =>
        work(drizzleTransaction(tx as unknown as DrizzleDB)),
      );
    },
  };
}
