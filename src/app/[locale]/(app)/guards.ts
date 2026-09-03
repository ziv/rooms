import "server-only";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getActor } from "@/modules/auth/current";
import { approvedSiteIds, isAdmin, type Actor } from "@/modules/auth/actor";

/** Page-level guard: signed in and active, else redirect to login. */
export async function requireSession(): Promise<Actor> {
  const actor = await getActor();
  const locale = await getLocale();
  if (!actor) redirect(`/${locale}/login`);
  if (actor.status !== "ACTIVE") redirect(`/${locale}/login?error=disabled`);
  return actor;
}

/**
 * Page-level guard for business screens: profile completed and at least one
 * approved site (admins skip the membership requirement).
 */
export async function requireOnboarded(): Promise<Actor> {
  const actor = await requireSession();
  const locale = await getLocale();
  if (!actor.fullName) redirect(`/${locale}/onboarding`);
  if (!isAdmin(actor) && approvedSiteIds(actor).length === 0) redirect(`/${locale}/onboarding/pending`);
  return actor;
}

export async function requireAdminPage(): Promise<Actor> {
  const actor = await requireOnboarded();
  const locale = await getLocale();
  if (!isAdmin(actor)) redirect(`/${locale}/calendar`);
  return actor;
}
