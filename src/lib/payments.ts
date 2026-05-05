import { db } from "./db";
import { payments, plans, activityLog } from "../schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import Stripe from "stripe";

/**
 * Fulfill an order from a Stripe Checkout Session (legacy flow).
 * Records the payment as completed. UniFi authorization happens client-side
 * on the success page (the user's browser can reach the local gateway).
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

  // 5. Log Activity (UniFi authorization happens client-side)
  await db.insert(activityLog).values({
    paymentId: paymentRecord.id,
    eventType: "user_created_pending_auth",
    details: JSON.stringify({
      username,
      sessionId: session.id,
      macAddress,
    }),
  });

  console.log(`>>> Fulfill: Success for ${username}`);
  return paymentRecord;
}

/**
 * Fulfill an order from a Stripe PaymentIntent (new embedded flow).
 * Records the payment as completed. UniFi authorization happens client-side
 * on the success page (the user's browser can reach the local gateway).
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

  // 5. Log Activity (UniFi authorization happens client-side)
  await db.insert(activityLog).values({
    paymentId: paymentRecord.id,
    eventType: "user_created_pending_auth",
    details: JSON.stringify({
      username,
      paymentIntentId: paymentIntent.id,
      macAddress,
    }),
  });

  console.log(`>>> Fulfill: Success for ${username}`);
  return paymentRecord;
}
