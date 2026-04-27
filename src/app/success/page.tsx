import { db } from "@/lib/db";
import { payments } from "@/schema";
import { eq } from "drizzle-orm";
import { retrieveSession } from "@/lib/stripe";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  let session: Stripe.Checkout.Session;
  if (!sessionId) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#10003;</div>
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

  try {
    session = (await retrieveSession(sessionId)) as Stripe.Checkout.Session;
  } catch {
    notFound();
  }

  const payment: {
    username: string | null;
    password: string | null;
    status: string;
  } | null = await db
    .select()
    .from(payments)
    .where(eq(payments.stripeSessionId, sessionId))
    .then((rows) => rows[0] || null);

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

  if (payment.username && payment.password) {
    const loginUrl = new URL(env.portal.hotspotLoginUrl);
    loginUrl.searchParams.set("username", payment.username);
    loginUrl.searchParams.set("password", payment.password);

    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4 text-emerald-500">&#10003;</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-stone-500 mb-8">
            Your access has been created. Please click below to complete your
            connection.
          </p>

          <meta httpEquiv="refresh" content={`1;url=${loginUrl.toString()}`} />

          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(function() { window.location.href = "${loginUrl.toString()}"; }, 500);`,
            }}
          />

          <a
            href={loginUrl.toString()}
            className="inline-block w-full rounded-lg bg-stone-900 px-8 py-4 text-lg font-bold text-white hover:bg-stone-800 transition-all shadow-lg active:scale-95"
          >
            Continue to Internet
          </a>

          <p className="mt-8 text-xs text-stone-400">
            If you are not redirected automatically, please click the button
            above.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-stone-500 mb-6">
          Your payment was received but we could not set up your account. Please
          contact support.
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
