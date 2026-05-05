/**
 * Lightweight database migration runner.
 *
 * Reads SQL files from the /drizzle directory in order
 * and executes them against the DATABASE_URL.
 * Tracks applied migrations in a _migrations table.
 *
 * This replaces the need for drizzle-kit in the production Docker image.
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");
const MIGRATIONS_TABLE = "_migrations";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(">>> MIGRATE: DATABASE_URL not set, skipping migrations");
    return;
  }

  const sql = postgres(databaseUrl);

  try {
    // Create migrations tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(MIGRATIONS_TABLE)} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )
    `;

    // Get already applied migrations
    const applied = await sql`
      SELECT name FROM ${sql(MIGRATIONS_TABLE)} ORDER BY id
    `;
    const appliedNames = new Set(applied.map((r) => r.name));

    // Read migration files, sorted by name (they're prefixed with numbers)
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log(">>> MIGRATE: No migration files found");
      return;
    }

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`>>> MIGRATE: Already applied: ${file}`);
        continue;
      }

      console.log(`>>> MIGRATE: Applying ${file}...`);
      const migrationSql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");

      // Split on statement breakpoints and execute each statement
      const statements = migrationSql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Run in a transaction
      await sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement);
        }
        await tx`
          INSERT INTO ${sql(MIGRATIONS_TABLE)} (name) VALUES (${file})
        `;
      });

      console.log(`>>> MIGRATE: Applied ${file}`);
    }

    console.log(">>> MIGRATE: All migrations applied");
  } catch (error) {
    console.error(">>> MIGRATE: Error running migrations:", error);
    // Don't exit with error — let the app try to start anyway
    // If the schema is truly broken, the app will surface the real error
  } finally {
    await sql.end();
  }
}

runMigrations();
