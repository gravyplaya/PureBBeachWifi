import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import { disconnectUser } from "@/lib/mikrotik";

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();

    const { userId } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "Valid userId is required" },
        { status: 400 },
      );
    }

    await disconnectUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect user" },
      { status: 500 },
    );
  }
}
