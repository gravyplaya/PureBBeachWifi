import { db } from "@/lib/db";
import { payments, plans } from "@/schema";
import { sql, gte, and, eq, count, sum } from "drizzle-orm";
import { StatsCard } from "@/components/admin/StatsCard";
import { getActiveUsers } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const todayResults = await db
    .select({
      count: count(),
      revenue: sum(payments.amountCents),
    })
    .from(payments)
    .where(
      and(
        gte(payments.createdAt, today),
        eq(payments.status, "completed"),
      ),
    );

  const weekResults = await db
    .select({
      count: count(),
      revenue: sum(payments.amountCents),
    })
    .from(payments)
    .where(
      and(
        gte(payments.createdAt, weekAgo),
        eq(payments.status, "completed"),
      ),
    );

  const monthResults = await db
    .select({
      count: count(),
      revenue: sum(payments.amountCents),
    })
    .from(payments)
    .where(
      and(
        gte(payments.createdAt, monthAgo),
        eq(payments.status, "completed"),
      ),
    );

  const activePlanCount = await db
    .select({ count: count() })
    .from(plans)
    .where(eq(plans.isActive, true));

  let activeUserCount = 0;
  try {
    const activeUsers = await getActiveUsers();
    activeUserCount = activeUsers.length;
  } catch {
    // Router unreachable
  }

  const recentPayments = await db
    .select()
    .from(payments)
    .orderBy(sql`${payments.createdAt} desc`)
    .limit(10);

  const todayRevenue = Number(todayResults[0]?.revenue || 0);
  const weekRevenue = Number(weekResults[0]?.revenue || 0);
  const monthRevenue = Number(monthResults[0]?.revenue || 0);
  const todayCount = Number(todayResults[0]?.count || 0);
  const weekCount = Number(weekResults[0]?.count || 0);
  const monthCount = Number(monthResults[0]?.count || 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Today's Revenue"
          value={`$${(todayRevenue / 100).toFixed(2)}`}
          subtitle={`${todayCount} payments`}
        />
        <StatsCard
          title="This Week"
          value={`$${(weekRevenue / 100).toFixed(2)}`}
          subtitle={`${weekCount} payments`}
        />
        <StatsCard
          title="This Month"
          value={`$${(monthRevenue / 100).toFixed(2)}`}
          subtitle={`${monthCount} payments`}
        />
        <StatsCard
          title="Active Users"
          value={String(activeUserCount)}
          subtitle={`${activePlanCount[0]?.count || 0} active plans`}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          Recent Payments
        </h2>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">
                    Session ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">
                    Amount
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">
                    MAC Address
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">
                      {p.stripeSessionId.slice(0, 16)}...
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-900">
                      ${(p.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {p.macAddress || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {recentPayments.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-stone-400"
                    >
                      No payments yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
