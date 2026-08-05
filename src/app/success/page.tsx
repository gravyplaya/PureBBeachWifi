import { db } from "@/lib/db";
import { payments, activityLog } from "@/schema";
import { eq } from "drizzle-orm";
import { retrieveSession, retrievePaymentIntent } from "@/lib/stripe";
import { fulfillOrder, fulfillPaymentIntent } from "@/lib/payments";
import { env } from "@/lib/env";
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

    // Payment completed — check if hotspot user was created
    const hotspotCreated = await wasHotspotUserCreated(payment.id);
    return (
      <MikroTikLoginResult
        payment={payment}
        hotspotCreated={hotspotCreated}
      />
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

  const hotspotCreated = await wasHotspotUserCreated(payment.id);
  return (
    <MikroTikLoginResult
      payment={payment}
      hotspotCreated={hotspotCreated}
    />
  );
}

/**
 * Check the activity log to see if the hotspot user was successfully created.
 */
async function wasHotspotUserCreated(paymentId: number): Promise<boolean> {
  const logs = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.paymentId, paymentId))
    .limit(50);

  return logs.some(
    (log) => log.eventType === "hotspot_user_created",
  );
}

/**
 * Server component that renders the success page with auto-login to MikroTik.
 * If the hotspot user was created successfully, it auto-redirects to the
 * MikroTik login URL with the credentials. Otherwise, shows manual instructions.
 */
function MikroTikLoginResult({
  payment,
  hotspotCreated,
}: {
  payment: any;
  hotspotCreated: boolean;
}) {
  const hotspotLoginUrl = env.portal.hotspotLoginUrl;

  // Build the auto-login URL with credentials
  const autoLoginUrl = `${hotspotLoginUrl}?username=${encodeURIComponent(payment.username)}&password=${encodeURIComponent(payment.password)}`;

  if (hotspotCreated) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4 text-emerald-500">&#10003;</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-stone-500 mb-6">
            Your WiFi access is ready. Connecting you to the network...
          </p>

          {/* Auto-redirect to MikroTik login */}
          <meta httpEquiv="refresh" content={`2;url=${autoLoginUrl}`} />
          <noscript>
            <a
              href={autoLoginUrl}
              className="inline-block w-full rounded-lg bg-stone-900 px-8 py-4 text-lg font-bold text-white hover:bg-stone-800 transition-all shadow-lg active:scale-95"
            >
              Connect to WiFi
            </a>
          </noscript>

          <script dangerouslySetInnerHTML={{ __html: `
            window.location.replace('${autoLoginUrl}');
          ` }} />

          <div className="mt-8 p-4 bg-stone-100 rounded-lg text-left text-xs text-stone-500">
            <p className="font-medium text-stone-700 mb-1">
              If you are not redirected automatically:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Tap the button below to log in</li>
              <li>Your access will expire at {new Date(payment.expiresAt).toLocaleString()}</li>
            </ol>
          </div>

          <a
            href={autoLoginUrl}
            className="mt-4 inline-block w-full rounded-lg bg-stone-900 px-8 py-4 text-lg font-bold text-white hover:bg-stone-800 transition-all shadow-lg active:scale-95"
          >
            Connect to WiFi
          </a>
        </div>
      </main>
    );
  }

  // Hotspot user creation failed — show manual login fallback
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4 text-amber-500">&#9888;</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">
          Payment Successful
        </h1>
        <p className="text-stone-500 mb-6">
          Your payment was processed, but we could not automatically provision
          your device on the network. You can try connecting manually.
        </p>

        <div className="mt-6 p-4 bg-stone-100 rounded-lg text-left text-sm space-y-2">
          <p className="font-medium text-stone-700">Manual Login:</p>
          <p>
            <span className="text-stone-500">Username:</span>{" "}
            <span className="font-mono text-stone-900">{payment.username}</span>
          </p>
          <p>
            <span className="text-stone-500">Password:</span>{" "}
            <span className="font-mono text-stone-900">{payment.password}</span>
          </p>
        </div>

        <a
          href={autoLoginUrl}
          className="mt-6 inline-block w-full rounded-lg bg-stone-900 px-8 py-4 text-lg font-bold text-white hover:bg-stone-800 transition-all shadow-lg active:scale-95"
        >
          Try Auto-Login
        </a>

        <a
          href={hotspotLoginUrl}
          className="mt-4 inline-block text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          Go to login page
        </a>
      </div>
    </main>
  );
}
