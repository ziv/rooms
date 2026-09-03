import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/** Applies migrations to the test database once per vitest run. */
export default async function globalSetup() {
  config({ path: ".env.test" });
  config({ path: ".env.local" });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for tests");
  if (!/rooms_test|localhost:5432|test/.test(url)) {
    throw new Error(`Refusing to run integration tests against non-test database: ${url}`);
  }
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  } finally {
    await sql.end();
  }
}
