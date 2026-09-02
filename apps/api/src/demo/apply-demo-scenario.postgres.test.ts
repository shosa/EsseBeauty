import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { MODULE_KEYS } from "@esse-beauty/feature-flags";
import {
  appointments,
  customers,
  salonLocations,
  salons,
  services,
  staff,
  userCredentials,
  users,
} from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../test/postgres.js";
import { verifyPassword } from "../routes/auth/local-auth.js";
import { applyDemoScenario } from "./apply-demo-scenario.js";
import { buildDemoScenario } from "./build-demo-scenario.js";
import { DEMO_IDENTITY } from "./scenario-types.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

const scenarioOptions = {
  anchor: new Date("2026-09-02T10:00:00.000Z"),
  moduleKeys: Object.values(MODULE_KEYS),
  seed: 20260902,
};

postgresSuite("applyDemoScenario with PostgreSQL", () => {
  let db: DrizzleDB;
  let sentinelSalonId: string;

  beforeAll(async () => {
    db = createDatabase(databaseUrl!);
    sentinelSalonId = randomUUID();
    await db.insert(salons).values({
      id: sentinelSalonId,
      locale: "it-IT",
      name: "Sentinel Salon (non-Demo)",
      slug: `sentinel-${sentinelSalonId}`,
      timezone: "Europe/Rome",
    });
    await db.insert(users).values({
      email: "sentinel-owner@example.invalid",
      fullName: "Sentinel Owner",
      id: randomUUID(),
      role: "owner",
      salonId: sentinelSalonId,
    });
  }, 30_000);

  afterAll(async () => {
    await db.delete(salons).where(eq(salons.id, sentinelSalonId));
    const demoSalon = await db.select({ id: salons.id }).from(salons).where(eq(salons.slug, DEMO_IDENTITY.salonSlug));
    if (demoSalon[0]) {
      await db.delete(salons).where(eq(salons.id, demoSalon[0].id));
    }
    await db.$client.end();
  }, 30_000);

  it("creates the Demo tenant, leaves other tenants untouched, and is idempotent on reapply", async () => {
    const sentinelUsersBefore = await db.select().from(users).where(eq(users.salonId, sentinelSalonId));
    const sentinelSalonBefore = await db.select().from(salons).where(eq(salons.id, sentinelSalonId));

    const scenario = buildDemoScenario(scenarioOptions);
    const firstReport = await applyDemoScenario(db, scenario, { ownerPassword: "demo123456" });

    expect(firstReport.dryRun).toBe(false);
    expect(firstReport.replacedTenantId).toBeNull();

    const demoSalonRows = await db.select().from(salons).where(eq(salons.slug, DEMO_IDENTITY.salonSlug));
    expect(demoSalonRows).toHaveLength(1);
    expect(demoSalonRows[0]!.id).toBe(firstReport.tenantId);

    const demoOwnerRows = await db
      .select()
      .from(users)
      .where(eq(users.email, DEMO_IDENTITY.ownerEmail));
    expect(demoOwnerRows).toHaveLength(1);

    const credentialRows = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, demoOwnerRows[0]!.id));
    expect(credentialRows).toHaveLength(1);
    const verified = await verifyPassword("demo123456", credentialRows[0]!.passwordSalt, credentialRows[0]!.passwordHash);
    expect(verified).toBe(true);

    const demoLocations = await db.select().from(salonLocations).where(eq(salonLocations.salonId, firstReport.tenantId));
    const demoStaff = await db.select().from(staff).where(eq(staff.salonId, firstReport.tenantId));
    const demoServices = await db.select().from(services).where(eq(services.salonId, firstReport.tenantId));
    const demoCustomers = await db.select().from(customers).where(eq(customers.salonId, firstReport.tenantId));
    const demoAppointments = await db.select().from(appointments).where(eq(appointments.salonId, firstReport.tenantId));
    expect(demoLocations.length).toBe(scenario.rows.salonLocations.length);
    expect(demoStaff.length).toBe(scenario.rows.staff.length);
    expect(demoServices.length).toBe(scenario.rows.services.length);
    expect(demoCustomers.length).toBe(scenario.rows.customers.length);
    expect(demoAppointments.length).toBe(scenario.rows.appointments.length);

    const sentinelUsersAfterFirst = await db.select().from(users).where(eq(users.salonId, sentinelSalonId));
    const sentinelSalonAfterFirst = await db.select().from(salons).where(eq(salons.id, sentinelSalonId));
    expect(sentinelUsersAfterFirst).toEqual(sentinelUsersBefore);
    expect(sentinelSalonAfterFirst).toEqual(sentinelSalonBefore);

    const secondReport = await applyDemoScenario(db, scenario, { ownerPassword: "demo123456" });
    expect(secondReport.replacedTenantId).toBe(firstReport.tenantId);
    expect(secondReport.tenantId).toBe(firstReport.tenantId);
    expect(secondReport.rowCounts).toEqual(firstReport.rowCounts);

    const demoSalonRowsAfterSecond = await db.select().from(salons).where(eq(salons.slug, DEMO_IDENTITY.salonSlug));
    expect(demoSalonRowsAfterSecond).toHaveLength(1);
    const demoAppointmentsAfterSecond = await db
      .select()
      .from(appointments)
      .where(eq(appointments.salonId, secondReport.tenantId));
    expect(demoAppointmentsAfterSecond.length).toBe(scenario.rows.appointments.length);

    const sentinelUsersAfterSecond = await db.select().from(users).where(eq(users.salonId, sentinelSalonId));
    const sentinelSalonAfterSecond = await db.select().from(salons).where(eq(salons.id, sentinelSalonId));
    expect(sentinelUsersAfterSecond).toEqual(sentinelUsersBefore);
    expect(sentinelSalonAfterSecond).toEqual(sentinelSalonBefore);
  }, 120_000);

  it("supports a dry run that makes no database changes", async () => {
    const before = await db.select({ count: sql<number>`count(*)` }).from(salons);
    const scenario = buildDemoScenario(scenarioOptions);
    const report = await applyDemoScenario(db, scenario, { dryRun: true, ownerPassword: "demo123456" });
    expect(report.dryRun).toBe(true);
    const after = await db.select({ count: sql<number>`count(*)` }).from(salons);
    expect(after[0]!.count).toBe(before[0]!.count);
  }, 30_000);
});
