import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plans, payments } from "@/schema";
import { eq, and } from "drizzle-orm";
import { createPaymentIntent } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, macAddress } = body;

    if (!planId || typeof planId !== "number") {
      return NextResponse.json(
        { error: "Valid planId is required" },
        { status: 400 },
      );
    }

    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found or inactive" },
        { status: 404 },
      );
    }

    const { clientSecret, paymentIntentId } = await createPaymentIntent({
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      macAddress,
      durationMinutes: plan.durationMinutes,
    });

    // Create a pending payment record so we can track it
    await db.insert(payments).values({
      stripeSessionId: `pi_${paymentIntentId}`,
      stripePaymentIntentId: paymentIntentId,
      amountCents: plan.priceCents,
      planId: plan.id,
      macAddress: macAddress || null,
      status: "pending",
    });

    return NextResponse.json({ clientSecret, paymentIntentId });
  } catch (error) {
    console.error("PaymentIntent creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 },
    );
  }
}
