import { db } from "@/lib/db";
import { payments } from "@/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const allPayments = await db
    .select()
    .from(payments)
    .orderBy(sql`${payments.createdAt} desc`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Payments</h1>
        <span className="text-sm text-stone-500">
          {allPayments.length} total
        </span>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Session</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">MAC</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Created</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {allPayments.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-500">{p.id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {p.stripeSessionId.slice(0, 20)}...
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-900">
                    ${(p.amountCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{p.planId || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {p.macAddress || "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {p.username || "-"}
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
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {p.expiresAt
                      ? new Date(p.expiresAt).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
              {allPayments.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-stone-400">
                    No payments yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
