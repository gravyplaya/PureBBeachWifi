import { env } from "./env";

interface UniFiSite {
  id: string;
  name: string;
}

interface UniFiClient {
  id: string;
  name?: string;
  macAddress: string;
  access: {
    type: string;
    authorized: boolean;
    authorization?: {
      authorizedAt: string;
      expiresAt?: string;
      dataUsageLimitMBytes?: number;
    };
  };
}

class UniFiAPIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "UniFiAPIError";
  }
}

async function unifiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = env.unifi.apiUrl;
  const apiKey = env.unifi.apiKey;

  if (!baseUrl || !apiKey) {
    throw new UniFiAPIError(
      500,
      "UniFi API not configured. Set UNIFI_API_URL and UNIFI_API_KEY.",
    );
  }

  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new UniFiAPIError(
      response.status,
      body.message || body.error || response.statusText,
    );
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/**
 * Get all sites managed by this UniFi Network Application.
 */
export async function getSites(): Promise<UniFiSite[]> {
  return unifiRequest<UniFiSite[]>("/v1/sites");
}

/**
 * Get clients on a site, optionally filtered by MAC address.
 */
export async function getClients(
  siteId: string,
  macAddress?: string,
): Promise<UniFiClient[]> {
  let path = `/v1/sites/${siteId}/clients`;
  if (macAddress) {
    path += `?filter=macAddress.eq('${macAddress}')`;
  }
  return unifiRequest<UniFiClient[]>(path);
}

/**
 * Get a single client by MAC address.
 */
export async function getClientByMac(
  macAddress: string,
): Promise<UniFiClient | null> {
  const siteId = env.unifi.siteId;
  if (!siteId) {
    throw new UniFiAPIError(500, "UNIFI_SITE_ID not configured");
  }

  const clients = await getClients(siteId, macAddress);
  return clients.length > 0 ? clients[0] : null;
}

/**
 * Authorize a guest client on the UniFi network.
 */
export async function authorizeGuest(params: {
  clientId: string;
  timeLimitMinutes?: number;
  dataUsageLimitMBytes?: number;
  rxRateLimitKbps?: number;
  txRateLimitKbps?: number;
}): Promise<void> {
  const siteId = env.unifi.siteId;
  if (!siteId) {
    throw new UniFiAPIError(500, "UNIFI_SITE_ID not configured");
  }

  const body: Record<string, unknown> = {
    action: "AUTHORIZE_GUEST_ACCESS",
  };

  if (params.timeLimitMinutes) {
    body.timeLimitMinutes = params.timeLimitMinutes;
  }
  if (params.dataUsageLimitMBytes) {
    body.dataUsageLimitMBytes = params.dataUsageLimitMBytes;
  }
  if (params.rxRateLimitKbps) {
    body.rxRateLimitKbps = params.rxRateLimitKbps;
  }
  if (params.txRateLimitKbps) {
    body.txRateLimitKbps = params.txRateLimitKbps;
  }

  await unifiRequest(
    `/v1/sites/${siteId}/clients/${params.clientId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

/**
 * Convenience: authorize a guest by MAC address.
 * Looks up the clientId first, then authorizes.
 */
export async function authorizeGuestByMac(params: {
  macAddress: string;
  timeLimitMinutes?: number;
  dataUsageLimitMBytes?: number;
  rxRateLimitKbps?: number;
  txRateLimitKbps?: number;
}): Promise<void> {
  const client = await getClientByMac(params.macAddress);
  if (!client) {
    throw new UniFiAPIError(
      404,
      `Client not found with MAC ${params.macAddress}. Ensure the device is connected to the guest network.`,
    );
  }

  await authorizeGuest({
    clientId: client.id,
    timeLimitMinutes: params.timeLimitMinutes,
    dataUsageLimitMBytes: params.dataUsageLimitMBytes,
    rxRateLimitKbps: params.rxRateLimitKbps,
    txRateLimitKbps: params.txRateLimitKbps,
  });
}

/**
 * Check if UniFi API is configured and reachable.
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getSites();
    return true;
  } catch {
    return false;
  }
}

export type { UniFiSite, UniFiClient, UniFiAPIError };
