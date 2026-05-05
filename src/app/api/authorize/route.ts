import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/schema";
import { eq } from "drizzle-orm";
import { authorizeGuestByMac } from "@/lib/unifi";
import { env } from "@/lib/env";

/**
 * Authorize a device on UniFi after payment completion.
 * Accepts JSON body: { paymentIntentId, macAddress }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, macAddress } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 },
      );
    }

    // Find the payment record
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .limit(1);

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 },
      );
    }

    if (payment.status !== "completed") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 },
      );
    }

    const mac = macAddress || payment.macAddress;
    if (!mac) {
      return NextResponse.json(
        { error: "No MAC address available for authorization" },
        { status: 400 },
      );
    }

    if (!env.unifi.apiUrl || !env.unifi.apiKey) {
      return NextResponse.json(
        { error: "UniFi API not configured" },
        { status: 500 },
      );
    }

    // Authorize the device on UniFi
    await authorizeGuestByMac({
      macAddress: mac,
      timeLimitMinutes: payment.expiresAt
        ? Math.max(
            1,
            Math.round(
              (new Date(payment.expiresAt).getTime() - Date.now()) / 60000,
            ),
          )
        : undefined,
    });

    return NextResponse.json({
      authorized: true,
      macAddress: mac,
    });
  } catch (error: any) {
    console.error("UniFi authorization error:", error);
    return NextResponse.json(
      {
        authorized: false,
        error: error.message || "Failed to authorize device",
      },
      { status: 500 },
    );
  }
}
