import { db } from "./db";
import { payments, plans, activityLog } from "../schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHotspotUser, getHotspotUser } from "./mikrotik";
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

  // 3. Create Mikrotik User
  const username = existingPayment?.username || `user_${nanoid(8)}`;
  const password = existingPayment?.password || nanoid(16);

  // Check if user already exists in Mikrotik to avoid errors
  const existingMikrotikUser = await getHotspotUser(username);
  if (!existingMikrotikUser) {
    await createHotspotUser({
      username,
      password,
      profile: plan.mikrotikProfile,
      macAddress: macAddress || undefined,
      limitUptime: durationMinutes
        ? `${Number(durationMinutes)}m`
        : `${plan.durationMinutes}m`,
      comment: `stripe:${session.id}`,
    });
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(
    expiresAt.getMinutes() + (Number(durationMinutes) || plan.durationMinutes),
  );

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

  // 5. Authorize on UniFi if configured
  if (macAddress && env.unifi.apiUrl && env.unifi.apiKey) {
    try {
      await authorizeGuestByMac({
        macAddress,
        timeLimitMinutes: Number(durationMinutes) || plan.durationMinutes,
      });
      console.log(`>>> UniFi: Authorized ${macAddress}`);
    } catch (error) {
      console.error(
        `>>> UniFi: Authorization failed for ${macAddress}:`,
        error,
      );
      // Don't fail the whole order — MikroTik auth may still work
    }
  }

  // 6. Log Activity
  await db.insert(activityLog).values({
    paymentId: paymentRecord.id,
    eventType: "user_created",
    details: JSON.stringify({ username, sessionId: session.id }),
  });

  console.log(`>>> Fulfill: Success for ${username}`);
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

  // 3. Create Mikrotik User
  const username = existingPayment?.username || `user_${nanoid(8)}`;
  const password = existingPayment?.password || nanoid(16);

  const existingMikrotikUser = await getHotspotUser(username);
  if (!existingMikrotikUser) {
    await createHotspotUser({
      username,
      password,
      profile: plan.mikrotikProfile,
      macAddress: macAddress || undefined,
      limitUptime: durationMinutes
        ? `${Number(durationMinutes)}m`
        : `${plan.durationMinutes}m`,
      comment: `stripe:pi_${paymentIntent.id}`,
    });
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(
    expiresAt.getMinutes() + (Number(durationMinutes) || plan.durationMinutes),
  );

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

  // 5. Authorize on UniFi if configured
  if (macAddress && env.unifi.apiUrl && env.unifi.apiKey) {
    try {
      await authorizeGuestByMac({
        macAddress,
        timeLimitMinutes: Number(durationMinutes) || plan.durationMinutes,
      });
      console.log(`>>> UniFi: Authorized ${macAddress}`);
    } catch (error) {
      console.error(
        `>>> UniFi: Authorization failed for ${macAddress}:`,
        error,
      );
      // Don't fail the whole order — MikroTik auth may still work
    }
  }

  // 6. Log Activity
  await db.insert(activityLog).values({
    paymentId: paymentRecord.id,
    eventType: "user_created",
    details: JSON.stringify({ username, paymentIntentId: paymentIntent.id }),
  });

  console.log(`>>> Fulfill: Success for ${username}`);
  return paymentRecord;
}
