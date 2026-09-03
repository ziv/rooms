import "server-only";
import { and, eq, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AppError, notFound, validation } from "@/lib/errors";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/modules/auth/actor";
import { requireAdmin } from "@/modules/auth/guards";
import type { DecideMembershipInput } from "@/lib/validation/memberships";
import type { SiteMembership, MembershipStatus } from "@/lib/db/schema";
import { enqueue, enqueueForAdmins } from "@/modules/notifications/outbox";

export async function listForUser(userId: string): Promise<SiteMembership[]> {
  return db.query.siteMemberships.findMany({ where: eq(schema.siteMemberships.userId, userId) });
}

/** Therapist requests to join a site. Re-requesting after REJECTED is allowed; PENDING/APPROVED/SUSPENDED are not. */
export async function requestMembership(actor: Actor, siteId: string): Promise<SiteMembership> {
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) });
  if (!site || site.status !== "ACTIVE") throw notFound("site");

  return db.transaction(async (tx) => {
    const existing = await tx.query.siteMemberships.findFirst({
      where: and(eq(schema.siteMemberships.siteId, siteId), eq(schema.siteMemberships.userId, actor.userId)),
    });
    let row: SiteMembership;
    if (!existing) {
      [row] = await tx
        .insert(schema.siteMemberships)
        .values({ siteId, userId: actor.userId, status: "PENDING" })
        .returning();
    } else if (existing.status === "REJECTED") {
      [row] = await tx
        .update(schema.siteMemberships)
        .set({ status: "PENDING", requestedAt: new Date(), decidedAt: null, decidedBy: null })
        .where(eq(schema.siteMemberships.id, existing.id))
        .returning();
    } else {
      throw new AppError("ALREADY_EXISTS", `Membership is ${existing.status}`);
    }
    await audit(tx, {
      actor,
      siteId,
      action: "MEMBERSHIP_REQUESTED",
      entityType: "membership",
      entityId: row.id,
      before: existing ? { status: existing.status } : null,
      after: { status: row.status },
    });
    await enqueueForAdmins(tx, "MEMBERSHIP_REQUESTED", {
      siteId: site.id,
      siteName: site.name,
      userId: actor.userId,
      userName: actor.fullName,
      userEmail: actor.email,
    });
    return row;
  });
}

const ALLOWED: Record<MembershipStatus, MembershipStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
  REJECTED: ["APPROVED"],
};

export async function decideMembership(actor: Actor, input: DecideMembershipInput): Promise<SiteMembership> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const existing = await tx.query.siteMemberships.findFirst({
      where: eq(schema.siteMemberships.id, input.membershipId),
    });
    if (!existing) throw notFound("membership");
    if (!ALLOWED[existing.status].includes(input.status)) {
      throw validation({ transition: `${existing.status} -> ${input.status}` });
    }
    const [row] = await tx
      .update(schema.siteMemberships)
      .set({ status: input.status, decidedAt: new Date(), decidedBy: actor.userId })
      .where(eq(schema.siteMemberships.id, existing.id))
      .returning();
    await audit(tx, {
      actor,
      siteId: existing.siteId,
      action: "MEMBERSHIP_DECIDED",
      entityType: "membership",
      entityId: row.id,
      before: { status: existing.status },
      after: { status: row.status, userId: row.userId },
    });
    const [user, site] = await Promise.all([
      tx.query.users.findFirst({ where: eq(schema.users.id, existing.userId) }),
      tx.query.sites.findFirst({ where: eq(schema.sites.id, existing.siteId) }),
    ]);
    if (user && site) {
      await enqueue(tx, {
        userId: user.id,
        locale: user.preferredLocale,
        type: "MEMBERSHIP_DECIDED",
        payload: { siteId: site.id, siteName: site.name, status: row.status },
      });
    }
    return row;
  });
}

export type MembershipRow = {
  id: string;
  siteId: string;
  siteName: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  status: MembershipStatus;
  requestedAt: Date;
  decidedAt: Date | null;
};

/** Admin: all memberships across sites (optionally one site / one status). */
export async function listMemberships(
  actor: Actor,
  filter: { siteId?: string; status?: MembershipStatus } = {},
): Promise<MembershipRow[]> {
  requireAdmin(actor);
  const conds = [];
  if (filter.siteId) conds.push(eq(schema.siteMemberships.siteId, filter.siteId));
  if (filter.status) conds.push(eq(schema.siteMemberships.status, filter.status));
  return db
    .select({
      id: schema.siteMemberships.id,
      siteId: schema.siteMemberships.siteId,
      siteName: schema.sites.name,
      userId: schema.siteMemberships.userId,
      userName: schema.users.fullName,
      userEmail: schema.users.email,
      status: schema.siteMemberships.status,
      requestedAt: schema.siteMemberships.requestedAt,
      decidedAt: schema.siteMemberships.decidedAt,
    })
    .from(schema.siteMemberships)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.siteMemberships.siteId))
    .innerJoin(schema.users, eq(schema.users.id, schema.siteMemberships.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(schema.siteMemberships.status), asc(schema.siteMemberships.requestedAt));
}

/** Approved members of a site (for admin "book for therapist" picker). */
export async function listApprovedMembers(actor: Actor, siteId: string) {
  requireAdmin(actor);
  return db
    .select({ userId: schema.users.id, fullName: schema.users.fullName, email: schema.users.email })
    .from(schema.siteMemberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.siteMemberships.userId))
    .where(and(eq(schema.siteMemberships.siteId, siteId), eq(schema.siteMemberships.status, "APPROVED")))
    .orderBy(asc(schema.users.fullName));
}
