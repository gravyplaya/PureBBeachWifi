import { getActiveUsers, disconnectUser } from "@/lib/mikrotik";
import { MikroTikActiveUser } from "@/lib/mikrotik";
import { DisconnectButton } from "@/components/admin/DisconnectButton";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  let activeUsers: MikroTikActiveUser[] = [];
  let routerError = false;

  try {
    activeUsers = await getActiveUsers();
  } catch {
    routerError = true;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Active Users</h1>
        <span className="text-sm text-stone-500">
          {activeUsers.length} connected
        </span>
      </div>

      {routerError && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
          Could not connect to MikroTik router. Check your API settings.
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">IP Address</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">MAC Address</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Login Method</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Uptime</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Time Left</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {activeUsers.map((user) => (
                <tr key={user[".id"]} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {user.user}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {user.address}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {user["mac-address"]}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {user["login-by"]}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{user.uptime}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {user["session-time-left"]}
                  </td>
                  <td className="px-4 py-3">
                    <DisconnectButton userId={user[".id"]} username={user.user} />
                  </td>
                </tr>
              ))}
              {activeUsers.length === 0 && !routerError && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                    No active users
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
