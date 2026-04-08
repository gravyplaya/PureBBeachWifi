"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DisconnectButtonProps {
  userId: string;
  username: string;
}

export function DisconnectButton({ userId, username }: DisconnectButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    if (!confirm(`Disconnect user "${username}"?`)) return;

    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    setLoading(false);

    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to disconnect user");
    }
  }

  return (
    <button
      type="button"
      onClick={handleDisconnect}
      disabled={loading}
      className="px-3 py-1 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 disabled:opacity-50 transition-colors"
    >
      {loading ? "Disconnecting..." : "Disconnect"}
    </button>
  );
}
