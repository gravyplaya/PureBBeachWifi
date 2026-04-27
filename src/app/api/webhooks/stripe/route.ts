import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { constructWebhookEvent } from "@/lib/stripe";
import { createHotspotUser, getHotspotUser } from "@/lib/mikrotik";
import { db } from "@/lib/db";
import { payments, plans, activityLog } from "@/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  console.log(">>> STRIPE WEBHOOK START");
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    console.error(">>> WEBHOOK ERROR: Missing signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature);
    console.log(`>>> WEBHOOK EVENT: ${event.type}`);
  } catch (err) {
    console.error(">>> WEBHOOK SIGNATURE ERROR:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const { planId, macAddress, durationMinutes } = session.metadata || {};
  console.log(`>>> PROCESSING SESSION: ${session.id}, planId: ${planId}`);

  try {
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, Number(planId)))
      .limit(1);

    if (!plan) {
      console.error(`>>> WEBHOOK ERROR: Plan not found: ${planId}`);
      return NextResponse.json({ error: "Plan not found" }, { status: 500 });
    }

    const username = `user_${nanoid(8)}`;
    const password = nanoid(16);

    const existingUser = await getHotspotUser(username);
    if (existingUser) {
      console.error(`User already exists: ${username}`);
      return NextResponse.json(
        { error: "User already exists" },
        { status: 500 },
      );
    }

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

    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() +
        (Number(durationMinutes) || plan.durationMinutes),
    );

    await db.insert(payments).values({
      stripeSessionId: session.id,
      amountCents: session.amount_total || plan.priceCents,
      planId: plan.id,
      macAddress: macAddress || null,
      username,
      password,
      status: "completed",
      expiresAt,
    });

    await db.insert(activityLog).values({
      eventType: "user_created",
      details: JSON.stringify({ username, sessionId: session.id }),
    });

    console.log(`Hotspot user created: ${username} for session ${session.id}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);

    await db.insert(payments).values({
      stripeSessionId: session.id,
      amountCents: session.amount_total || 0,
      planId: Number(planId) || null,
      macAddress: macAddress || null,
      status: "failed",
    });

    await db.insert(activityLog).values({
      eventType: "error",
      details: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        sessionId: session.id,
      }),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
