import { and, eq, gte, isNull } from "drizzle-orm";

import {
  loyaltyEarningRules,
  loyaltyPoints,
} from "@esse-beauty/db/schema";

export const LOYALTY_RULE_DEFAULTS = [
  { action: "appointment_completed", active: true, points: 10 },
  { action: "service_purchased", active: false, points: 5 },
  { action: "product_purchased", active: false, points: 1 },
  { action: "euro_spent", active: false, points: 1 },
  { action: "birthday", active: false, points: 20 },
  { action: "review_submitted", active: false, points: 5 },
] as const;

export type LoyaltyRuleAction = (typeof LOYALTY_RULE_DEFAULTS)[number]["action"];
type EarningRuleRow = typeof loyaltyEarningRules.$inferSelect;

export async function ensureLoyaltyRules(db: any, salonId: string, appointmentPoints = 10) {
  await db.insert(loyaltyEarningRules).values(
    LOYALTY_RULE_DEFAULTS.map((rule) => ({
      ...rule,
      points: rule.action === "appointment_completed" ? appointmentPoints : rule.points,
      salonId,
    })),
  ).onConflictDoNothing();
  return db.select().from(loyaltyEarningRules).where(eq(loyaltyEarningRules.salonId, salonId));
}

export async function awardSaleLoyalty(
  db: any,
  input: {
    appointmentId?: string | null;
    customerId?: string | null;
    discountCents?: number;
    items: Array<{ item_type: string; quantity: number; totalCents: number }>;
    saleId: string;
    salonId: string;
  },
) {
  if (!input.customerId) return [];
  const rules = await ensureLoyaltyRules(db, input.salonId);
  const rulesByAction = new Map<LoyaltyRuleAction, EarningRuleRow>(
    (rules as EarningRuleRow[]).map((rule) => [rule.action as LoyaltyRuleAction, rule]),
  );
  const awards: Array<{ delta: number; reason: string; ruleKey: LoyaltyRuleAction }> = [];
  const serviceQuantity = input.items.filter((item) => item.item_type === "service").reduce((sum, item) => sum + item.quantity, 0);
  const productQuantity = input.items.filter((item) => item.item_type === "product").reduce((sum, item) => sum + item.quantity, 0);
  const eligibleGrossCents = input.items.filter((item) => item.item_type === "service" || item.item_type === "product").reduce((sum, item) => sum + item.totalCents, 0);
  const eligibleCents = Math.max(0, eligibleGrossCents - Math.min(eligibleGrossCents, input.discountCents ?? 0));

  const appointmentRule = rulesByAction.get("appointment_completed");
  if (input.appointmentId && appointmentRule?.active && appointmentRule.points > 0) {
    awards.push({ delta: appointmentRule.points, reason: "Appuntamento completato", ruleKey: "appointment_completed" });
  }
  const serviceRule = rulesByAction.get("service_purchased");
  if (serviceQuantity > 0 && serviceRule?.active && serviceRule.points > 0) {
    awards.push({ delta: serviceQuantity * serviceRule.points, reason: "Acquisto servizi", ruleKey: "service_purchased" });
  }
  const productRule = rulesByAction.get("product_purchased");
  if (productQuantity > 0 && productRule?.active && productRule.points > 0) {
    awards.push({ delta: productQuantity * productRule.points, reason: "Acquisto prodotti", ruleKey: "product_purchased" });
  }
  const euroRule = rulesByAction.get("euro_spent");
  const wholeEuros = Math.floor(eligibleCents / 100);
  if (wholeEuros > 0 && euroRule?.active && euroRule.points > 0) {
    awards.push({ delta: wholeEuros * euroRule.points, reason: "Spesa in salone", ruleKey: "euro_spent" });
  }

  for (const award of awards) {
    await db.insert(loyaltyPoints).values({
      appointmentId: award.ruleKey === "appointment_completed" ? input.appointmentId : null,
      customerId: input.customerId,
      delta: award.delta,
      reason: award.reason,
      ruleKey: award.ruleKey,
      saleId: input.saleId,
      salonId: input.salonId,
    }).onConflictDoNothing();
  }
  return awards;
}

export async function awardReviewSubmission(
  db: any,
  input: { customerId: string; salonId: string },
) {
  const rules = await ensureLoyaltyRules(db, input.salonId);
  const rule = rules.find((item: any) => item.action === "review_submitted");
  if (!rule?.active || rule.points <= 0) return 0;
  await db.insert(loyaltyPoints).values({
    customerId: input.customerId,
    delta: rule.points,
    reason: "Recensione lasciata",
    ruleKey: "review_submitted",
    salonId: input.salonId,
  });
  return rule.points;
}

export async function expireSaleLoyaltyPoints(
  db: any,
  input: { saleId: string; salonId: string },
): Promise<void> {
  await db.update(loyaltyPoints).set({ expiredAt: new Date() }).where(and(
    eq(loyaltyPoints.salonId, input.salonId),
    eq(loyaltyPoints.saleId, input.saleId),
    isNull(loyaltyPoints.expiredAt),
  ));
}

export async function awardBirthdayPoints(
  db: any,
  input: { customerId: string; points: number; salonId: string },
): Promise<boolean> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const alreadyAwarded = await db.select({ id: loyaltyPoints.id }).from(loyaltyPoints).where(and(
    eq(loyaltyPoints.customerId, input.customerId),
    eq(loyaltyPoints.ruleKey, "birthday"),
    gte(loyaltyPoints.createdAt, yearStart),
  ));
  if (alreadyAwarded.length > 0) return false;
  await db.insert(loyaltyPoints).values({
    customerId: input.customerId,
    delta: input.points,
    reason: "Buon compleanno!",
    ruleKey: "birthday",
    salonId: input.salonId,
  });
  return true;
}
