import Stripe from "stripe";
import { requireEnv } from "./env";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2025-04-30.basil",
      typescript: true,
    });
  }
  return _stripe;
}

export interface PlanCheckoutParams {
  planId: number;
  planName: string;
  amountCents: number;
  macAddress?: string;
  durationMinutes: number;
}

export async function createCheckoutSession(
  params: PlanCheckoutParams,
): Promise<string> {
  const stripe = getStripe();
  const portalUrl = process.env.PORTAL_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: params.amountCents,
          product_data: {
            name: `${params.planName} - WiFi Access`,
            description: `${params.durationMinutes} minute${params.durationMinutes > 1 ? "s" : ""} of WiFi access`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      planId: String(params.planId),
      macAddress: params.macAddress || "",
      durationMinutes: String(params.durationMinutes),
    },
    success_url: `${portalUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${portalUrl}/`,
  });

  return session.url!;
}

export function constructWebhookEvent(
  payload: string,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    requireEnv("STRIPE_WEBHOOK_SECRET"),
  );
}

export async function retrieveSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}
