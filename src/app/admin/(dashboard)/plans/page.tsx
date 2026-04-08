"use client";

import { useState, useEffect } from "react";
import type { Plan } from "@/schema";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: 60,
    priceCents: 100,
    mikrotikProfile: "",
    rateLimit: "",
    isActive: true,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    const res = await fetch("/api/admin/plans");
    if (res.ok) {
      const data = await res.json();
      setPlans(data);
    }
    setLoading(false);
  }

  function handleEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || "",
      durationMinutes: plan.durationMinutes,
      priceCents: plan.priceCents,
      mikrotikProfile: plan.mikrotikProfile,
      rateLimit: plan.rateLimit || "",
      isActive: plan.isActive,
    });
    setShowForm(true);
  }

  function resetForm() {
    setForm({
      name: "",
      description: "",
      durationMinutes: 60,
      priceCents: 100,
      mikrotikProfile: "",
      rateLimit: "",
      isActive: true,
    });
    setEditingPlan(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const url = editingPlan
      ? `/api/admin/plans?id=${editingPlan.id}`
      : "/api/admin/plans";
    const method = editingPlan ? "PATCH" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      resetForm();
      fetchPlans();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to save plan");
    }
  }

  async function handleToggle(plan: Plan) {
    const res = await fetch(`/api/admin/plans?id=${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });

    if (res.ok) {
      fetchPlans();
    }
  }

  async function handleDelete(plan: Plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;

    const res = await fetch(`/api/admin/plans?id=${plan.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      fetchPlans();
    } else {
      alert("Failed to delete plan");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-900">Plans</h1>
        <p className="text-stone-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Plans</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
          >
            Add Plan
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-semibold text-stone-900">
            {editingPlan ? "Edit Plan" : "New Plan"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Price (cents)
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.priceCents}
                onChange={(e) =>
                  setForm({ ...form, priceCents: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({ ...form, durationMinutes: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                MikroTik Profile
              </label>
              <input
                type="text"
                required
                value={form.mikrotikProfile}
                onChange={(e) =>
                  setForm({ ...form, mikrotikProfile: e.target.value })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Rate Limit (e.g. 5M/5M)
              </label>
              <input
                type="text"
                value={form.rateLimit}
                onChange={(e) =>
                  setForm({ ...form, rateLimit: e.target.value })
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="rounded border-stone-300"
                />
                <span className="text-sm font-medium text-stone-700">
                  Active
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
            >
              {editingPlan ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Profile</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Rate Limit</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {plan.name}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    ${(plan.priceCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {plan.durationMinutes}m
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {plan.mikrotikProfile}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {plan.rateLimit || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggle(plan)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                        plan.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {plan.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(plan)}
                        className="px-2 py-1 rounded text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(plan)}
                        className="px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                    No plans created yet
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
