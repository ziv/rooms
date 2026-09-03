import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

declare global {
  var __roomsSql: ReturnType<typeof postgres> | undefined;
}

// Reuse the connection across HMR reloads in dev. `prepare: false` is required for
// Supavisor transaction-mode pooling in production.
const client =
  globalThis.__roomsSql ??
  postgres(env().DATABASE_URL, {
    prepare: false,
    max: env().NODE_ENV === "production" ? 5 : 3,
  });
if (env().NODE_ENV !== "production") globalThis.__roomsSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
