"use client";

import { useState, useEffect } from "react";

interface UniFiAuthorizerProps {
  macAddress: string | null;
  durationMinutes: number | null;
  unifiApiUrl: string;
  unifiApiKey: string;
  unifiSiteId: string;
}

/**
 * Client-side UniFi authorization component.
 * The user's browser is on the local network and can reach the UniFi gateway directly,
 * so we make the API call from the client instead of the server.
 */
export function UniFiAuthorizer({
  macAddress,
  durationMinutes,
  unifiApiUrl,
  unifiApiKey,
  unifiSiteId,
}: UniFiAuthorizerProps) {
  const [status, setStatus] = useState<
    "authorizing" | "connected" | "failed"
  >("authorizing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!macAddress) {
      setStatus("failed");
      setError("No MAC address available");
      return;
    }

    async function authorize() {
      try {
        // 1. Find the client by MAC address
        const clientsUrl = `${unifiApiUrl}/integration/v1/sites/${unifiSiteId}/clients?filter=macAddress.eq('${macAddress}')`;
        const clientsRes = await fetch(clientsUrl, {
          headers: {
            "X-API-KEY": unifiApiKey,
            Accept: "application/json",
          },
        });

        if (!clientsRes.ok) {
          const body = await clientsRes.json().catch(() => ({}));
          throw new Error(
            `Failed to find device (${clientsRes.status}): ${body.message || body.error || clientsRes.statusText}`,
          );
        }

        const clients = await clientsRes.json();
        const client = Array.isArray(clients) ? clients[0] : null;

        if (!client || !client.id) {
          throw new Error(
            `Device ${macAddress} not found. Make sure the device is connected to the guest WiFi network.`,
          );
        }

        // 2. Authorize the guest
        const authBody: Record<string, unknown> = {
          action: "AUTHORIZE_GUEST_ACCESS",
        };
        if (durationMinutes) {
          authBody.timeLimitMinutes = durationMinutes;
        }

        const authUrl = `${unifiApiUrl}/integration/v1/sites/${unifiSiteId}/clients/${client.id}/actions`;
        const authRes = await fetch(authUrl, {
          method: "POST",
          headers: {
            "X-API-KEY": unifiApiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(authBody),
        });

        if (!authRes.ok) {
          const body = await authRes.json().catch(() => ({}));
          throw new Error(
            `Authorization failed (${authRes.status}): ${body.message || body.error || authRes.statusText}`,
          );
        }

        setStatus("connected");
      } catch (err: any) {
        console.error(">>> UniFi client-side authorization error:", err);
        setError(err.message || String(err));
        setStatus("failed");
      }
    }

    authorize();
  }, [macAddress, durationMinutes, unifiApiUrl, unifiApiKey, unifiSiteId]);

  if (status === "authorizing") {
    return (
      <>
        <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-stone-900 mb-2">
          Connecting Your Device
        </h1>
        <p className="text-stone-500 mb-8">
          Payment received! Authorizing your device on the network...
        </p>
      </>
    );
  }

  if (status === "connected") {
    return (
      <>
        <div className="text-5xl mb-4 text-emerald-500">&#10003;</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">
          You&apos;re Connected!
        </h1>
        <p className="text-stone-500 mb-8">
          Your device has been authorized on the network. You should have internet
          access now.
        </p>
        <a
          href="http://captive.apple.com"
          className="inline-block w-full rounded-lg bg-stone-900 px-8 py-4 text-lg font-bold text-white hover:bg-stone-800 transition-all shadow-lg active:scale-95"
        >
          Continue to Internet
        </a>
      </>
    );
  }

  // Failed
  return (
    <>
      <div className="text-5xl mb-4 text-amber-500">&#9888;</div>
      <h1 className="text-2xl font-bold text-stone-900 mb-2">
        Payment Successful
      </h1>
      <p className="text-stone-500 mb-6">
        Your payment was processed, but we could not automatically connect your
        device to the network.
      </p>

      {macAddress ? (
        <p className="text-sm text-stone-400 mb-6">
          Device MAC: {macAddress}
        </p>
      ) : (
        <p className="text-sm text-stone-400 mb-6">
          No device MAC address was provided with this purchase.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500 mb-4">Error: {error}</p>
      )}

      <button
        onClick={() => {
          setStatus("authorizing");
          setError(null);
        }}
        className="w-full rounded-lg bg-stone-900 px-8 py-4 text-lg font-bold text-white hover:bg-stone-800 transition-all shadow-lg active:scale-95"
      >
        Retry Connection
      </button>

      <a
        href="/"
        className="mt-4 inline-block text-sm text-stone-400 hover:text-stone-600 transition-colors"
      >
        Back to Plans
      </a>
    </>
  );
}
