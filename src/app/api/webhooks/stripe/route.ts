import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { constructWebhookEvent } from "@/lib/stripe";
import { fulfillOrder } from "@/lib/payments";
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
  console.log(`>>> WEBHOOK: Processing session: ${session.id}`);

  try {
    await fulfillOrder(session);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(">>> WEBHOOK ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Add GET handler for easy reachability testing
export async function GET() {
  return new NextResponse(
    "Webhook endpoint is active. Use POST for Stripe webhooks.",
  );
}
