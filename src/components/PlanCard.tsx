"use client";

import { useRouter } from "next/navigation";
import type { Plan } from "@/schema";

interface PlanCardProps {
  plan: Plan;
  macAddress?: string;
}

export function PlanCard({ plan, macAddress }: PlanCardProps) {
  const router = useRouter();
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

  function handlePurchase() {
    const params = new URLSearchParams({ planId: String(plan.id) });
    if (macAddress) params.set("mac", macAddress);
    router.push(`/checkout?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-stone-900">{plan.name}</h2>
        <span className="text-2xl font-bold text-stone-900">${price}</span>
      </div>

      {plan.description && (
        <p className="text-sm text-stone-500 mb-3">{plan.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-stone-600 mb-4">
        <span className="flex items-center gap-1">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
            />
          </svg>
          {label}
        </span>
        {plan.rateLimit && (
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {plan.rateLimit}
          </span>
        )}
      </div>

      <button
        onClick={handlePurchase}
        className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2"
      >
        Purchase
      </button>
    </div>
  );
}
