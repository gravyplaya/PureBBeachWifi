"use client";

import { type FormEvent } from "react";
import type { Plan } from "@/schema";

interface PlanCardProps {
  plan: Plan;
  macAddress?: string;
}

export function PlanCard({ plan, macAddress }: PlanCardProps) {
  const price = (plan.priceCents / 100).toFixed(2);
  const mins = plan.durationMinutes;

  function formatDuration(totalMins: number) {
    if (totalMins < 60) return `${totalMins} Min`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (m === 0) return `${h} Hour${h > 1 ? "s" : ""}`;
    return `${h}h ${m}m`;
  }

  const label = formatDuration(mins);

  async function handlePurchase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const planId = formData.get("planId") as string;
    const mac = formData.get("macAddress") as string;

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: Number(planId), macAddress: mac }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create checkout session");
    }

    const data = await res.json();
    window.location.href = data.url;
  }

  return (
    <form
      onSubmit={handlePurchase}
      className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-stone-900">{plan.name}</h2>
        <span className="text-2xl font-bold text-stone-900">${price}</span>
      </div>

      {plan.description && (
        <p className="text-sm text-stone-500 mb-3">{plan.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-stone-600 mb-4">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
          {label}
        </span>
        {plan.rateLimit && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {plan.rateLimit}
          </span>
        )}
      </div>

      <input type="hidden" name="planId" value={plan.id} />
      <input type="hidden" name="macAddress" value={macAddress || ""} />

      <button
        type="submit"
        className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2"
      >
        Purchase
      </button>
    </form>
  );
}
