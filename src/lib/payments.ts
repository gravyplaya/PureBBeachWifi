import { db } from "./db";
import { payments, plans, activityLog } from "../schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHotspotUser, getHotspotUser } from "./mikrotik";
import Stripe from "stripe";

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

  // 5. Log Activity
  await db.insert(activityLog).values({
    paymentId: paymentRecord.id,
    eventType: "user_created",
    details: JSON.stringify({ username, sessionId: session.id }),
  });

  console.log(`>>> Fulfill: Success for ${username}`);
  return paymentRecord;
}
