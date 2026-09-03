import "dotenv/config";
import { config } from "dotenv";

// Prefer .env.test, fall back to .env.local (local Supabase).
config({ path: ".env.test" });
config({ path: ".env.local" });
process.env.SUPER_ADMIN_EMAIL ??= "admin@test.local";
