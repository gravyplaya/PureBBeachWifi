import { testConnection, getSystemResource } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const isConnected = await testConnection();

  let routerInfo = null;
  if (isConnected) {
    try {
      routerInfo = await getSystemResource();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-stone-900">Settings</h1>

      <div className="grid gap-6">
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            MikroTik Connection
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}
              />
              <span className="text-sm font-medium text-stone-700">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {routerInfo && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-500">Board:</span>{" "}
                  <span className="font-medium text-stone-900">
                    {routerInfo["board-name"]}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500">RouterOS:</span>{" "}
                  <span className="font-medium text-stone-900">
                    {routerInfo.version}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500">CPU Load:</span>{" "}
                  <span className="font-medium text-stone-900">
                    {routerInfo["cpu-load"]}%
                  </span>
                </div>
                <div>
                  <span className="text-stone-500">Uptime:</span>{" "}
                  <span className="font-medium text-stone-900">
                    {routerInfo.uptime}
                  </span>
                </div>
              </div>
            )}

            {!isConnected && (
              <p className="text-sm text-stone-500">
                Unable to connect to the MikroTik router. Verify the API URL,
                username, and password in your environment variables.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            Environment Variables
          </h2>
          <div className="space-y-2 text-sm font-mono">
            {[
              "MIKROTIK_API_URL",
              "STRIPE_SECRET_KEY",
              "STRIPE_PUBLISHABLE_KEY",
              "STRIPE_WEBHOOK_SECRET",
              "DATABASE_URL",
              "PORTAL_URL",
              "HOTSPOT_LOGIN_URL",
              "UNIFI_API_URL",
              "UNIFI_API_KEY",
              "UNIFI_SITE_ID",
            ].map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${process.env[key] ? "bg-emerald-500" : "bg-red-500"}`}
                />
                <span className="text-stone-600">{key}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
