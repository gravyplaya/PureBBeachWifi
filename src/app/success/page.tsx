import { db } from "@/lib/db";
import { payments } from "@/schema";
import { eq } from "drizzle-orm";
import { retrieveSession, retrievePaymentIntent } from "@/lib/stripe";
import { fulfillOrder, fulfillPaymentIntent } from "@/lib/payments";
import { env } from "@/lib/env";
import { UniFiAuthorizer } from "@/components/UniFiAuthorizer";
import { notFound } from "next/navigation";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    payment_intent_id?: string;
  }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;
  const paymentIntentId = params.payment_intent_id;

  const isPaymentIntentFlow = !!paymentIntentId;

  // ─── PaymentIntent Flow ───────────────────────────────────────
  if (isPaymentIntentFlow) {
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await retrievePaymentIntent(paymentIntentId);
    } catch {
      notFound();
    }

    let payment: any = await db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .then((rows) => rows[0] || null);

    // Fallback: If the webhook hasn't finished, but the payment intent succeeded, fulfill it here
    let fallbackError = null;
    if (
      (!payment || payment.status !== "completed") &&
      paymentIntent.status === "succeeded"
    ) {
      console.log(
        `>>> SuccessPage Fallback: Fulfilling PaymentIntent ${paymentIntentId}`,
      );
      try {
        payment = await fulfillPaymentIntent(paymentIntent);
      } catch (error: any) {
        console.error(">>> SuccessPage Fallback Error:", error);
        fallbackError = error.message || String(error);
      }
    }

    // Still processing
    if (!payment || payment.status !== "completed") {
      return (
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-md w-full text-center">
            <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-stone-900 mb-2">
              Processing Payment
            </h1>
            <p className="text-stone-500 mb-6">
              Your payment is being processed. You&apos;ll be connected shortly.
            </p>

            <div className="mt-8 p-4 bg-stone-100 rounded-lg text-left font-mono text-xs text-stone-600 overflow-auto">
              <p className="font-bold mb-2 text-stone-900 border-b border-stone-200 pb-1">
                Debug Info:
              </p>
              <p>
                <strong>PaymentIntent ID:</strong> {paymentIntentId}
              </p>
              <p>
                <strong>Stripe Status:</strong> {paymentIntent.status}
              </p>
              <p>
                <strong>DB Record:</strong> {payment ? "Found" : "Not Found"}
              </p>
              {payment && (
                <p>
                  <strong>DB Status:</strong> {payment.status}
                </p>
              )}
              {fallbackError && (
                <p className="text-red-600 mt-2">
                  <strong>Error:</strong> {fallbackError}
                </p>
              )}
            </div>

            <meta httpEquiv="refresh" content="5" />
          </div>
        </main>
      );
    }

    // Payment completed — authorize via client-side (user's browser is on the local network)
    const macAddress = payment.macAddress || paymentIntent.metadata?.macAddress;
    const durationMinutes = payment.expiresAt
      ? Math.max(
          1,
          Math.round(
            (new Date(payment.expiresAt).getTime() - Date.now()) / 60000,
          ),
        )
      : null;

    const unifiConfigured = !!(env.unifi.apiUrl && env.unifi.apiKey && env.unifi.siteId);

    if (!unifiConfigured || !macAddress) {
      return (
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-md w-full text-center">
            <div className="text-5xl mb-4 text-emerald-500">&#10003;</div>
            <h1 className="text-2xl font-bold text-stone-900 mb-2">
              Payment Successful!
            </h1>
            <p className="text-stone-500 mb-8">
              Your payment has been processed. {!macAddress ? "No device MAC was provided — please connect to the network manually." : "Your device will be connected shortly."}
            </p>
            <a
              href="/"
              className="inline-block rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
            >
              Back to Plans
            </a>
          </div>
        </main>
      );
    }

    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <UniFiAuthorizer
            macAddress={macAddress}
            durationMinutes={durationMinutes}
            unifiApiUrl={env.unifi.apiUrl!}
            unifiApiKey={env.unifi.apiKey!}
            unifiSiteId={env.unifi.siteId!}
          />
        </div>
      </main>
    );
  }

  // ─── Checkout Session Flow (legacy) ───────────────────────────
  if (!sessionId && !paymentIntentId) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            No session found
          </h1>
          <p className="text-stone-500 mb-6">
            Please return to the main page to purchase a plan.
          </p>
          <a
            href="/"
            className="inline-block rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
          >
            Back to Plans
          </a>
        </div>
      </main>
    );
  }

  let session: Stripe.Checkout.Session;
  try {
    session = (await retrieveSession(sessionId!)) as Stripe.Checkout.Session;
  } catch {
    notFound();
  }

  let payment: any = await db
    .select()
    .from(payments)
    .where(eq(payments.stripeSessionId, sessionId!))
    .then((rows) => rows[0] || null);

  let fallbackError = null;
  if (
    (!payment || payment.status !== "completed") &&
    session.payment_status === "paid"
  ) {
    console.log(`>>> SuccessPage Fallback: Fulfilling session ${sessionId}`);
    try {
      payment = await fulfillOrder(session);
    } catch (error: any) {
      console.error(">>> SuccessPage Fallback Error:", error);
      fallbackError = error.message || String(error);
    }
  }

  if (!payment || payment.status !== "completed") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Processing Payment
          </h1>
          <p className="text-stone-500 mb-6">
            Your payment is being processed. You&apos;ll be connected shortly.
          </p>
          <meta httpEquiv="refresh" content="5" />
        </div>
      </main>
    );
  }

  // Legacy session flow — authorize via client-side
  const macAddress = payment.macAddress || session.metadata?.macAddress;
  const durationMinutes = payment.expiresAt
    ? Math.max(
        1,
        Math.round(
          (new Date(payment.expiresAt).getTime() - Date.now()) / 60000,
        ),
      )
    : null;

  const unifiConfigured = !!(env.unifi.apiUrl && env.unifi.apiKey && env.unifi.siteId);

  if (!unifiConfigured || !macAddress) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4 text-emerald-500">&#10003;</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-stone-500 mb-8">
            Your payment has been processed.
          </p>
          <a
            href="/"
            className="inline-block rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
          >
            Back to Plans
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <UniFiAuthorizer
          macAddress={macAddress}
          durationMinutes={durationMinutes}
          unifiApiUrl={env.unifi.apiUrl!}
          unifiApiKey={env.unifi.apiKey!}
          unifiSiteId={env.unifi.siteId!}
        />
      </div>
    </main>
  );
}
