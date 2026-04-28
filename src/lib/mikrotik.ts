import { env } from "./env";

// Tell Node.js to allow self-signed certificates for the MikroTik API
// This is necessary because MikroTik routers often use auto-generated SSL certs
if (
  process.env.NODE_ENV !== "production" ||
  env.mikrotik.apiUrl.includes("10.5.50.1")
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

interface MikroTikHotspotUser {
  ".id": string;
  name: string;
  password?: string;
  profile: string;
  "mac-address"?: string;
  "limit-uptime"?: string;
  comment?: string;
  disabled?: string;
  server?: string;
}

interface MikroTikActiveUser {
  ".id": string;
  user: string;
  address: string;
  "mac-address": string;
  "login-by": string;
  uptime: string;
  "session-time-left": string;
}

interface MikroTikResource {
  version: string;
  "board-name": string;
  "cpu-load": string;
  uptime: string;
}

class MikroTikAPIError extends Error {
  constructor(
    public status: number,
    public detail: string,
    message: string,
  ) {
    super(message);
    this.name = "MikroTikAPIError";
  }
}

function getAuthHeader(): string {
  const credentials = Buffer.from(
    `${env.mikrotik.user}:${env.mikrotik.pass}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

async function mikrotikRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${env.mikrotik.apiUrl}/rest${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new MikroTikAPIError(
      response.status,
      body.detail || body.message || "Unknown error",
      `MikroTik API error: ${response.status} - ${body.message || response.statusText}`,
    );
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function createHotspotUser(params: {
  username: string;
  password: string;
  profile: string;
  macAddress?: string;
  limitUptime?: string;
  comment?: string;
}): Promise<MikroTikHotspotUser> {
  const body: Record<string, string> = {
    name: params.username,
    password: params.password,
    profile: params.profile,
  };

  if (params.macAddress) body["mac-address"] = params.macAddress;
  if (params.limitUptime) body["limit-uptime"] = params.limitUptime;
  if (params.comment) body["comment"] = params.comment;

  return mikrotikRequest<MikroTikHotspotUser>("/ip/hotspot/user", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getHotspotUser(
  username: string,
): Promise<MikroTikHotspotUser | null> {
  try {
    const users = await mikrotikRequest<MikroTikHotspotUser[]>(
      `/ip/hotspot/user?name=${encodeURIComponent(username)}`,
    );
    return users.length > 0 ? users[0] : null;
  } catch {
    return null;
  }
}

export async function removeHotspotUser(id: string): Promise<void> {
  await mikrotikRequest(`/ip/hotspot/user/${id}`, {
    method: "DELETE",
  });
}

export async function getActiveUsers(): Promise<MikroTikActiveUser[]> {
  return mikrotikRequest<MikroTikActiveUser[]>("/ip/hotspot/active");
}

export async function disconnectUser(id: string): Promise<void> {
  await mikrotikRequest(`/ip/hotspot/active/${id}`, {
    method: "DELETE",
  });
}

export async function getSystemResource(): Promise<MikroTikResource> {
  const resources =
    await mikrotikRequest<MikroTikResource[]>("/system/resource");
  return resources[0];
}

export async function testConnection(): Promise<boolean> {
  try {
    await getSystemResource();
    return true;
  } catch {
    return false;
  }
}

export type {
  MikroTikHotspotUser,
  MikroTikActiveUser,
  MikroTikResource,
  MikroTikAPIError,
};
