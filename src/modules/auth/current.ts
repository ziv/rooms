import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { unauthenticated, forbidden } from "@/lib/errors";
import { ensureUser } from "@/modules/users/service";
import { listForUser } from "@/modules/memberships/service";
import type { Actor } from "./actor";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/routing";

/**
 * Resolves the current Actor from the Supabase session. Cached per request.
 * Returns null when there is no valid session.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const h = await headers();
  const requestId = h.get("x-request-id") ?? randomUUID();

  const appUser = await ensureUser({
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.email_confirmed_at),
    requestId,
  });
  const memberships = await listForUser(appUser.id);

  return {
    userId: appUser.id,
    email: appUser.email,
    fullName: appUser.fullName,
    role: appUser.globalRole,
    status: appUser.status,
    locale: isLocale(appUser.preferredLocale) ? appUser.preferredLocale : DEFAULT_LOCALE,
    memberships: memberships.map((m) => ({ siteId: m.siteId, status: m.status })),
    requestId,
  };
});

/** Throws UNAUTHENTICATED / FORBIDDEN. Use in Server Actions and Route Handlers. */
export async function requireUser(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw unauthenticated();
  if (actor.status !== "ACTIVE") throw forbidden("User disabled");
  return actor;
}
