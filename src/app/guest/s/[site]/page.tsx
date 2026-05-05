import { redirect } from "next/navigation";

/**
 * UniFi External Portal Redirect Handler
 *
 * When UniFi's captive portal redirects a guest to the external portal server,
 * it sends them to: http://<portal-ip>/guest/s/<site>/?id=<mac>&ap=<ap-mac>&ssid=<ssid>&url=<original>
 *
 * This catch-all route captures that request and redirects to our actual
 * home page, preserving the query parameters (especially `id` which is the client MAC).
 */
export default async function UniFiGuestRedirect({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    ap?: string;
    ssid?: string;
    url?: string;
    t?: string;
  }>;
}) {
  const params = await searchParams;

  // Build the redirect URL to our home page
  // UniFi sends the client MAC as "id" — we pass it through as "id"
  // so the home page can pick it up
  const redirectUrl = new URL("/", "http://placeholder");
  if (params.id) redirectUrl.searchParams.set("id", params.id);
  if (params.ap) redirectUrl.searchParams.set("ap", params.ap);
  if (params.ssid) redirectUrl.searchParams.set("ssid", params.ssid);
  if (params.url) redirectUrl.searchParams.set("url", params.url);

  redirect(redirectUrl.toString().replace("http://placeholder", ""));
}

export const dynamic = "force-dynamic";
