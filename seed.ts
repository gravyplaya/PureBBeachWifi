import "dotenv/config";
import { db } from "@/lib/db";
import { plans } from "@/schema";

async function seed() {
  console.log("Seeding database...");

  await db.insert(plans).values([
    {
      name: "1 Hour",
      description: "Quick WiFi access for an hour",
      durationMinutes: 60,
      priceCents: 600,
      mikrotikProfile: "1-hour",
      rateLimit: "20M/20M",
      isActive: true,
    },
    {
      name: "24 Hours",
      description: "Full day WiFi access",
      durationMinutes: 1440,
      priceCents: 1200,
      mikrotikProfile: "24-hour",
      rateLimit: "20M/20M",
      isActive: true,
    },
    {
      name: "Weekly",
      description: "7 days of unlimited WiFi access",
      durationMinutes: 10080,
      priceCents: 4000,
      mikrotikProfile: "weekly",
      rateLimit: "20M/20M",
      isActive: true,
    },
    {
      name: "Extra 15 Min",
      description: "Extend your session by 15 minutes",
      durationMinutes: 15,
      priceCents: 200,
      mikrotikProfile: "extra-15min",
      rateLimit: "20M/20M",
      isActive: true,
    },
  ]);

  console.log("Seed completed successfully");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
