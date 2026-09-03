// Creates a production session URL for an email via a server-generated one-time link (token_hash).
// Usage: node scripts/prod-session.mjs <email> [next]   (requires SUPABASE_PROD_SERVICE_ROLE_KEY in .env.supabase)
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(fs.readFileSync(".env.supabase", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const PROD_URL = "https://adfbyvarfsfplfdjorgt.supabase.co";
const APP = "https://keshet.space";

export async function sessionUrl(email, next = "/calendar", { create = false } = {}) {
  const admin = createClient(PROD_URL, env.SUPABASE_PROD_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  if (create) {
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error && !/already/i.test(error.message)) throw error;
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return `${APP}/api/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&locale=he&next=${encodeURIComponent(next)}`;
}

if (process.argv[1]?.endsWith("prod-session.mjs")) {
  console.log(await sessionUrl(process.argv[2], process.argv[3]));
}
