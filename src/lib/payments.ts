import { db } from "./db";
import { payments, plans, activityLog } from "../schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import Stripe from "stripe";
import { createHotspotUser } from "./mikrotik";

/**
 * Convert a duration in minutes to a MikroTik limit-uptime string.
 * e.g. 60 → "1h", 360 → "6h", 1440 → "1d", 10080 → "7d", 15 → "15m"
 */
function minutesToUptime(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return `${minutes / 1440}d`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}m`;
}

/**
 * Create the hotspot user on the MikroTik router.
 * Logs to activity_log regardless of success/failure.
 */
async function provisionHotspotUser(
  paymentRecord: any,
  plan: any,
  macAddress: string | null,
  sessionId: string,
) {
  const username = paymentRecord.username;
  const password = paymentRecord.password;
  const limitUptime = minutesToUptime(plan.durationMinutes);

  try {
    await createHotspotUser({
      username,
      password,
      profile: plan.mikrotikProfile,
      macAddress: macAddress || undefined,
      limitUptime,
      comment: `stripe:${sessionId}`,
    });

    await db.insert(activityLog).values({
      paymentId: paymentRecord.id,
      eventType: "hotspot_user_created",
      details: JSON.stringify({
        username,
        profile: plan.mikrotikProfile,
        limitUptime,
        sessionId,
        macAddress,
      }),
    });

    console.log(
      `>>> Hotspot user created: ${username} (${limitUptime}, profile=${plan.mikrotikProfile})`,
    );
  } catch (err: any) {
    console.error(`>>> Failed to create hotspot user ${username}:`, err);

    await db.insert(activityLog).values({
      paymentId: paymentRecord.id,
      eventType: "hotspot_user_create_failed",
      details: JSON.stringify({
        username,
        profile: plan.mikrotikProfile,
        limitUptime,
        sessionId,
        macAddress,
        error: err.message || String(err),
      }),
    });

    // Don't throw — the payment is already collected.
    // The success page will show manual login instructions as fallback.
  }
}

/**
 * Fulfill an order from a Stripe Checkout Session (legacy redirect flow).
 * Records the payment, then provisions the hotspot user on MikroTik.
 */
export async function fulfillOrder(session: Stripe.Checkout.Session) {
  const { planId, macAddress, durationMinutes } = session.metadata || {};

  // 1. Check if we already processed this session
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripeSessionId, session.id))
    .limit(1);

  if (existingPayment && existingPayment.status === "completed") {
    console.log(`>>> Fulfill: Session ${session.id} already completed.`);
    return existingPayment;
  }

  console.log(`>>> Fulfilling order for session: ${session.id}`);

  // 2. Get the plan
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, Number(planId)))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }

  // 3. Generate credentials and compute expiry
  const username = existingPayment?.username || `user_${nanoid(8)}`;
  const password = existingPayment?.password || nanoid(16);
  const duration = Number(durationMinutes) || plan.durationMinutes;

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + duration);

  // 4. Update or Insert Database Record
  let paymentRecord;
  if (existingPayment) {
    [paymentRecord] = await db
      .update(payments)
      .set({
        status: "completed",
        username,
        password,
        expiresAt,
        amountCents: session.amount_total || plan.priceCents,
      })
      .where(eq(payments.id, existingPayment.id))
      .returning();
  } else {
    [paymentRecord] = await db
      .insert(payments)
      .values({
        stripeSessionId: session.id,
        amountCents: session.amount_total || plan.priceCents,
        planId: plan.id,
        macAddress: macAddress || null,
        username,
        password,
        status: "completed",
        expiresAt,
      })
      .returning();
  }

  // 5. Provision the hotspot user on the MikroTik router
  await provisionHotspotUser(
    paymentRecord,
    plan,
    macAddress || null,
    session.id,
  );

  console.log(`>>> Fulfill: Success for ${username}`);
  return paymentRecord;
}

/**
 * Fulfill an order from a Stripe PaymentIntent (embedded Elements flow).
 * Records the payment, then provisions the hotspot user on MikroTik.
 */
export async function fulfillPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
) {
  const { planId, macAddress, durationMinutes } = paymentIntent.metadata || {};

  // 1. Check if we already processed this payment intent
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .limit(1);

  if (existingPayment && existingPayment.status === "completed") {
    console.log(
      `>>> Fulfill: PaymentIntent ${paymentIntent.id} already completed.`,
    );
    return existingPayment;
  }

  console.log(`>>> Fulfilling order for PaymentIntent: ${paymentIntent.id}`);

  // 2. Get the plan
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, Number(planId)))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }

  // 3. Generate credentials and compute expiry
  const username = existingPayment?.username || `user_${nanoid(8)}`;
  const password = existingPayment?.password || nanoid(16);
  const duration = Number(durationMinutes) || plan.durationMinutes;

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + duration);

  // 4. Update or Insert Database Record
  let paymentRecord;
  if (existingPayment) {
    [paymentRecord] = await db
      .update(payments)
      .set({
        status: "completed",
        username,
        password,
        expiresAt,
        amountCents: paymentIntent.amount,
      })
      .where(eq(payments.id, existingPayment.id))
      .returning();
  } else {
    [paymentRecord] = await db
      .insert(payments)
      .values({
        stripeSessionId: `pi_${paymentIntent.id}`,
        stripePaymentIntentId: paymentIntent.id,
        amountCents: paymentIntent.amount,
        planId: plan.id,
        macAddress: macAddress || null,
        username,
        password,
        status: "completed",
        expiresAt,
      })
      .returning();
  }

  // 5. Provision the hotspot user on the MikroTik router
  await provisionHotspotUser(
    paymentRecord,
    plan,
    macAddress || null,
    paymentIntent.id,
  );

  console.log(`>>> Fulfill: Success for ${username}`);
  return paymentRecord;
}
