import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plans } from "@/schema";
import { eq, and } from "drizzle-orm";
import { createCheckoutSession } from "@/lib/stripe";

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

    const checkoutUrl = await createCheckoutSession({
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      macAddress,
      durationMinutes: plan.durationMinutes,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
