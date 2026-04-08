import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { plans } from "@/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();

    const allPlans = await db.select().from(plans).orderBy(plans.durationMinutes);
    return NextResponse.json(allPlans);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { name, description, durationMinutes, priceCents, mikrotikProfile, rateLimit, isActive } = body;

    if (!name || !durationMinutes || !priceCents || !mikrotikProfile) {
      return NextResponse.json(
        { error: "name, durationMinutes, priceCents, and mikrotikProfile are required" },
        { status: 400 },
      );
    }

    const [plan] = await db
      .insert(plans)
      .values({
        name,
        description: description || null,
        durationMinutes: Number(durationMinutes),
        priceCents: Number(priceCents),
        mikrotikProfile,
        rateLimit: rateLimit || null,
        isActive: isActive !== false,
      })
      .returning();

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Create plan error:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = await request.json();

    const [plan] = await db
      .update(plans)
      .set(body)
      .where(eq(plans.id, Number(id)))
      .returning();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(plans).where(eq(plans.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Delete plan error:", error);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
