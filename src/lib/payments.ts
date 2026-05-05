import { db } from "./db";
import { payments, plans, activityLog } from "../schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { authorizeGuestByMac } from "./unifi";
import { env } from "./env";
import Stripe from "stripe";

/**
 * Fulfill an order from a Stripe Checkout Session (legacy flow).
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

  // 3. Authorize device on UniFi
  const username = existingPayment?.username || `user_${nanoid(8)}`;
  const password = existingPayment?.password || nanoid(16);
  const duration = Number(durationMinutes) || plan.durationMinutes;

  let unifiAuthorized = false;
  if (macAddress && env.unifi.apiUrl && env.unifi.apiKey) {
    try {
      await authorizeGuestByMac({
        macAddress,
        timeLimitMinutes: duration,
      });
      unifiAuthorized = true;
      console.log(`>>> UniFi: Authorized ${macAddress} for ${duration}m`);
    } catch (error) {
      console.error(
        `>>> UniFi: Authorization failed for ${macAddress}:`,
        error,
      );
      // Don't fail the order — record it so we can retry authorization later
    }
  }

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

  // 5. Log Activity
  await db.insert(activityLog).values({
    paymentId: paymentRecord.id,
    eventType: unifiAuthorized ? "user_authorized" : "user_created_pending_auth",
    details: JSON.stringify({
      username,
      sessionId: session.id,
      macAddress,
      unifiAuthorized,
    }),
  });

  console.log(
    `>>> Fulfill: Success for ${username} (UniFi: ${unifiAuthorized ? "authorized" : "pending"})`,
  );
  return paymentRecord;
}

/**
 * Fulfill an order from a Stripe PaymentIntent (new embedded flow).
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

  // 3. Authorize device on UniFi
  const username = existingPayment?.username || `user_${nanoid(8)}`;
  const password = existingPayment?.password || nanoid(16);
  const duration = Number(durationMinutes) || plan.durationMinutes;

  let unifiAuthorized = false;
  if (macAddress && env.unifi.apiUrl && env.unifi.apiKey) {
    try {
      await authorizeGuestByMac({
        macAddress,
        timeLimitMinutes: duration,
      });
      unifiAuthorized = true;
      console.log(`>>> UniFi: Authorized ${macAddress} for ${duration}m`);
    } catch (error) {
      console.error(
        `>>> UniFi: Authorization failed for ${macAddress}:`,
        error,
      );
    }
  }

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

  // 5. Log Activity
  await db.insert(activityLog).values({
    paymentId: paymentRecord.id,
    eventType: unifiAuthorized ? "user_authorized" : "user_created_pending_auth",
    details: JSON.stringify({
      username,
      paymentIntentId: paymentIntent.id,
      macAddress,
      unifiAuthorized,
    }),
  });

  console.log(
    `>>> Fulfill: Success for ${username} (UniFi: ${unifiAuthorized ? "authorized" : "pending"})`,
  );
  return paymentRecord;
}
