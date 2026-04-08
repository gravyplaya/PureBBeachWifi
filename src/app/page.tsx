import { db } from "@/lib/db";
import { plans } from "@/schema";
import { eq } from "drizzle-orm";
import { PlanCard } from "@/components/PlanCard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ mac?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const activePlans = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.durationMinutes);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 mb-2">
          Get Connected
        </h1>
        <p className="text-stone-500 mb-8">
          Choose a plan to access the WiFi network
        </p>

        <div className="grid gap-4">
          {activePlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} macAddress={params.mac} />
          ))}
        </div>

        {activePlans.length === 0 && (
          <p className="text-stone-400 mt-8">No plans available at this time.</p>
        )}
      </div>
    </main>
  );
}
