import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type AuthAdmin = {
  /** Returns the auth user id for the email, creating a confirmed user when missing. */
  ensureAuthUser(email: string): Promise<{ id: string; created: boolean }>;
};

/** Supabase Auth admin API (service role). Never import from client components. */
export function supabaseAuthAdmin(): AuthAdmin {
  const key = env().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const client = createClient(env().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async ensureAuthUser(email) {
      const { data, error } = await client.auth.admin.createUser({ email, email_confirm: true });
      if (!error && data.user) return { id: data.user.id, created: true };
      if (error && /already|exists|registered/i.test(error.message)) {
        // Look the user up by email (paged listing; small user base).
        for (let page = 1; page <= 20; page++) {
          const { data: list, error: listErr } = await client.auth.admin.listUsers({ page, perPage: 200 });
          if (listErr) throw listErr;
          const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (found) return { id: found.id, created: false };
          if (list.users.length < 200) break;
        }
      }
      throw error ?? new Error("createUser returned no user");
    },
  };
}
