import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { audit } from "@/modules/audit/service";
import { approvedSiteIds, isAdmin, type Actor } from "@/modules/auth/actor";
import { requireAdmin, requireApprovedMember } from "@/modules/auth/guards";
import type { UpdateSiteInput } from "@/lib/validation/sites";
import type { Site } from "@/lib/db/schema";

/** All active sites: used for onboarding (any signed-in user may see names/addresses). */
export async function listActiveSites(): Promise<Site[]> {
  return db.query.sites.findMany({ where: eq(schema.sites.status, "ACTIVE"), orderBy: asc(schema.sites.name) });
}

/** Sites the actor can open: admin → all; therapist → approved memberships. */
export async function listAccessibleSites(actor: Actor): Promise<Site[]> {
  if (isAdmin(actor)) return db.query.sites.findMany({ orderBy: asc(schema.sites.name) });
  const ids = approvedSiteIds(actor);
  if (ids.length === 0) return [];
  return db.query.sites.findMany({ where: inArray(schema.sites.id, ids), orderBy: asc(schema.sites.name) });
}

export async function getSite(actor: Actor, siteId: string): Promise<Site> {
  requireApprovedMember(actor, siteId);
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) });
  if (!site) throw notFound("site");
  return site;
}

export async function updateSite(actor: Actor, input: UpdateSiteInput): Promise<Site> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const before = await tx.query.sites.findFirst({ where: eq(schema.sites.id, input.siteId) });
    if (!before) throw notFound("site");
    const [after] = await tx
      .update(schema.sites)
      .set({
        name: input.name,
        address: input.address,
        bookingWindowDays: input.bookingWindowDays,
        cancellationCutoffMinutes: input.cancellationCutoffMinutes,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.sites.id, input.siteId))
      .returning();
    await audit(tx, {
      actor,
      siteId: input.siteId,
      action: "SITE_UPDATED",
      entityType: "site",
      entityId: input.siteId,
      before: pick(before),
      after: pick(after),
    });
    return after;
  });
}

const pick = (s: Site) => ({
  name: s.name,
  address: s.address,
  bookingWindowDays: s.bookingWindowDays,
  cancellationCutoffMinutes: s.cancellationCutoffMinutes,
  status: s.status,
});
