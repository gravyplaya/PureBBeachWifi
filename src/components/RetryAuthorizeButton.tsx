"use client";

export function RetryAuthorizeButton({
  macAddress,
  paymentIntentId,
}: {
  macAddress?: string | null;
  paymentIntentId: string;
}) {
  return (
    <button
      onClick={async () => {
        try {
          const res = await fetch("/api/authorize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId, macAddress }),
          });
          const data = await res.json();
          if (data.authorized) {
            window.location.reload();
          } else {
            alert(data.error || "Authorization failed. Please try again.");
          }
        } catch {
          alert("Network error. Please try again.");
        }
      }}
      className="w-full rounded-lg bg-stone-900 px-8 py-4 text-lg font-bold text-white hover:bg-stone-800 transition-all shadow-lg active:scale-95"
    >
      Retry Connection
    </button>
  );
}
