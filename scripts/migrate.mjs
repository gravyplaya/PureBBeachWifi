/**
 * Lightweight database migration runner.
 *
 * Reads SQL files from the /drizzle directory in order
 * and executes them against the DATABASE_URL.
 * Tracks applied migrations in a _migrations table.
 *
 * This replaces the need for drizzle-kit in the production Docker image.
 * Handles the case where tables already exist (e.g. from a previous db:push).
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

    // If the _migrations table is empty but the payments table already exists,
    // it means the database was created with db:push. Mark all existing migration
    // files as already applied so only new migrations (like adding columns) will run.
    const existingMigrations = await sql`
      SELECT count(*)::int as count FROM ${sql(MIGRATIONS_TABLE)}
    `;

    if (existingMigrations[0].count === 0) {
      // Check if the core tables already exist
      const tableCheck = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payments'
      `;

      if (tableCheck.length > 0) {
        // Tables exist from db:push — mark all current migration files as applied
        const files = readdirSync(MIGRATIONS_DIR)
          .filter((f) => f.endsWith(".sql"))
          .sort();

        for (const file of files) {
          console.log(
            `>>> MIGRATE: Marking ${file} as applied (tables already exist from db:push)`,
          );
          await sql`
            INSERT INTO ${sql(MIGRATIONS_TABLE)} (name) VALUES (${file})
            ON CONFLICT (name) DO NOTHING
          `;
        }

        console.log(
          ">>> MIGRATE: Marked existing migrations as applied (database was created with db:push)",
        );
      }
    }

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

    let appliedCount = 0;
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
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log(">>> MIGRATE: All migrations already applied");
    } else {
      console.log(`>>> MIGRATE: Applied ${appliedCount} new migration(s)`);
    }
  } catch (error) {
    console.error(">>> MIGRATE: Error running migrations:", error);
    // Don't exit with error — let the app try to start anyway
    // If the schema is truly broken, the app will surface the real error
  } finally {
    await sql.end();
  }
}

runMigrations();
