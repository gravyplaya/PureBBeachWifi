"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";

interface PlanInfo {
  id: number;
  name: string;
  priceCents: number;
  durationMinutes: number;
  description?: string;
  rateLimit?: string;
}

function formatDuration(totalMins: number) {
  if (totalMins < 60) return `${totalMins} Min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (m === 0) return `${h} Hour${h > 1 ? "s" : ""}`;
  return `${h}h ${m}m`;
}

function CheckoutForm({ plan }: { plan: PlanInfo | null }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

    // Trigger form validation and wallet collection
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message || "Validation failed");
      setLoading(false);
      return;
    }

    // Confirm the payment
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success?payment_intent_id={PAYMENT_INTENT_ID}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "Payment failed");
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      // Payment succeeded without redirect — go to success page
      router.push(`/success?payment_intent_id=${paymentIntent.id}`);
      return;
    }

    // If we get here, Stripe is handling a redirect (3DS, etc.)
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {plan && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-stone-900">{plan.name}</h2>
              <p className="text-sm text-stone-500">
                {formatDuration(plan.durationMinutes)} of WiFi access
              </p>
            </div>
            <span className="text-xl font-bold text-stone-900">
              ${(plan.priceCents / 100).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <PaymentElement
        options={{
          layout: "tabs",
          paymentMethodOrder: ["card"],
        }}
      />

      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full rounded-lg bg-stone-900 px-4 py-3 text-sm font-medium text-white hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Processing...
          </span>
        ) : (
          `Pay $${plan ? (plan.priceCents / 100).toFixed(2) : "0.00"}`
        )}
      </button>

      <p className="text-xs text-stone-400 text-center">
        Payment is processed securely by Stripe. We never see your card details.
      </p>
    </form>
  );
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);

  const planId = searchParams.get("planId");
  const macAddress = searchParams.get("mac") || undefined;

  useEffect(() => {
    // Load Stripe publishable key
    async function init() {
      try {
        const configRes = await fetch("/api/config");
        if (!configRes.ok) throw new Error("Failed to load config");
        const config = await configRes.json();
        setStripePromise(loadStripe(config.publishableKey));
      } catch (err) {
        console.error("Failed to initialize Stripe:", err);
        setError("Failed to initialize payment system. Please try again.");
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!planId) {
      setError("No plan selected. Please go back and choose a plan.");
      return;
    }

    async function createIntent() {
      try {
        // Fetch plan details
        const planRes = await fetch(`/api/plans/${planId}`);
        if (!planRes.ok) throw new Error("Plan not found");
        const planData = await planRes.json();
        setPlan(planData);

        // Create PaymentIntent
        const res = await fetch("/api/payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: Number(planId), macAddress }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create payment");
        }

        const data = await res.json();
        setClientSecret(data.clientSecret);
      } catch (err: any) {
        console.error("Checkout setup error:", err);
        setError(err.message || "Failed to set up payment. Please try again.");
      }
    }

    createIntent();
  }, [planId, macAddress]);

  if (error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#9888;</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-stone-500 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-block rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
          >
            Back to Plans
          </button>
        </div>
      </main>
    );
  }

  if (!clientSecret || !stripePromise) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mx-auto mb-4" />
          <p className="text-stone-500">Loading payment form...</p>
        </div>
      </main>
    );
  }

  const appearance = {
    theme: "stripe" as const,
    variables: {
      colorPrimary: "#1c1917",
      colorBackground: "#ffffff",
      colorText: "#1c1917",
      colorDanger: "#dc2626",
      fontFamily: "system-ui, sans-serif",
      borderRadius: "8px",
    },
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold text-stone-900 mb-2 text-center">
          Complete Payment
        </h1>
        <p className="text-stone-500 mb-6 text-center">
          Enter your card details to get connected
        </p>

        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance,
            }}
          >
            <CheckoutForm plan={plan} />
          </Elements>
        </div>

        <button
          onClick={() => router.push("/")}
          className="mt-4 w-full text-center text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← Back to Plans
        </button>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-md w-full text-center">
            <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mx-auto mb-4" />
            <p className="text-stone-500">Loading...</p>
          </div>
        </main>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
