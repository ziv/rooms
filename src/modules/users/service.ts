import "server-only";
import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/modules/auth/actor";
import type {
  InviteUserInput,
  SetUserRoleInput,
  SetUserStatusInput,
  UpdateProfileInput,
  UpdateUserInput,
} from "@/lib/validation/users";
import { AppError, forbidden, notFound, validation } from "@/lib/errors";
import { requireAdmin } from "@/modules/auth/guards";
import { enqueue } from "@/modules/notifications/outbox";
import type { AuthAdmin } from "./auth-admin";
import type { User } from "@/lib/db/schema";

export type EnsureUserInput = { id: string; email: string; emailVerified: boolean; requestId: string };

/**
 * Provisions the application user row for a Supabase Auth user (idempotent).
 * Grants SUPER_ADMIN to the configured email on first login if no admin exists yet.
 */
export async function ensureUser(input: EnsureUserInput): Promise<User> {
  const adminEmail = env().SUPER_ADMIN_EMAIL.toLowerCase();
  const wantsAdmin = input.emailVerified && input.email.toLowerCase() === adminEmail;

  const existing = await db.query.users.findFirst({ where: eq(schema.users.id, input.id) });
  if (existing) {
    let row = existing;
    if (existing.email !== input.email) {
      [row] = await db
        .update(schema.users)
        .set({ email: input.email, updatedAt: new Date() })
        .where(eq(schema.users.id, input.id))
        .returning();
    }
    // SUPER_ADMIN_EMAIL may be configured after the owner's first login: promote lazily.
    if (wantsAdmin && row.globalRole !== "SUPER_ADMIN") row = (await promoteIfNoAdmin(row, input.requestId)) ?? row;
    return row;
  }

  return db.transaction(async (tx) => {
    let role: User["globalRole"] = "THERAPIST";
    if (wantsAdmin) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(eq(schema.users.globalRole, "SUPER_ADMIN"));
      if (count === 0) role = "SUPER_ADMIN";
    }
    const [created] = await tx
      .insert(schema.users)
      .values({ id: input.id, email: input.email, globalRole: role })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      // Lost a race with a concurrent first request; read the winner.
      const row = await tx.query.users.findFirst({ where: eq(schema.users.id, input.id) });
      if (!row) throw new Error("ensureUser: insert conflict but row missing");
      return row;
    }
    if (role === "SUPER_ADMIN") {
      await audit(tx, {
        actor: null,
        action: "ROLE_GRANTED",
        entityType: "user",
        entityId: created.id,
        after: { globalRole: "SUPER_ADMIN", email: created.email, requestId: input.requestId },
      });
    }
    return created;
  });
}

async function promoteIfNoAdmin(user: User, requestId: string): Promise<User | null> {
  return db.transaction(async (tx) => {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(eq(schema.users.globalRole, "SUPER_ADMIN"));
    if (count > 0) return null;
    const [updated] = await tx
      .update(schema.users)
      .set({ globalRole: "SUPER_ADMIN", updatedAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .returning();
    await audit(tx, {
      actor: null,
      action: "ROLE_GRANTED",
      entityType: "user",
      entityId: user.id,
      before: { globalRole: user.globalRole },
      after: { globalRole: "SUPER_ADMIN", email: user.email, requestId },
    });
    return updated;
  });
}

export async function updateProfile(actor: Actor, input: UpdateProfileInput): Promise<User> {
  const [updated] = await db
    .update(schema.users)
    .set({ fullName: input.fullName, preferredLocale: input.locale, updatedAt: new Date() })
    .where(eq(schema.users.id, actor.userId))
    .returning();
  return updated;
}

export async function getUser(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

// ---------- manager features ----------

export type UserRow = User & { memberships: { siteId: string; siteName: string; status: string }[] };

export async function listUsers(actor: Actor): Promise<UserRow[]> {
  requireAdmin(actor);
  const users = await db.query.users.findMany({
    orderBy: [asc(schema.users.globalRole), asc(schema.users.fullName), asc(schema.users.email)],
  });
  const rows = await db
    .select({
      userId: schema.siteMemberships.userId,
      siteId: schema.siteMemberships.siteId,
      siteName: schema.sites.name,
      status: schema.siteMemberships.status,
    })
    .from(schema.siteMemberships)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.siteMemberships.siteId));
  return users.map((u) => ({
    ...u,
    memberships: rows
      .filter((r) => r.userId === u.id)
      .map(({ siteId, siteName, status }) => ({ siteId, siteName, status })),
  }));
}

/** Promote to manager or demote to therapist. The last active manager cannot be demoted. */
export async function setUserRole(actor: Actor, input: SetUserRoleInput): Promise<User> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: eq(schema.users.id, input.userId) });
    if (!target) throw notFound("user");
    if (target.status !== "ACTIVE") throw validation({ status: "user is disabled" });
    if (target.globalRole === input.role) return target;
    if (input.role === "THERAPIST") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(and(eq(schema.users.globalRole, "SUPER_ADMIN"), eq(schema.users.status, "ACTIVE")));
      if (count <= 1) throw new AppError("LAST_ADMIN", "Cannot demote the last manager");
    }
    const [updated] = await tx
      .update(schema.users)
      .set({ globalRole: input.role, updatedAt: new Date() })
      .where(eq(schema.users.id, target.id))
      .returning();
    await audit(tx, {
      actor,
      action: input.role === "SUPER_ADMIN" ? "ROLE_GRANTED" : "ROLE_REVOKED",
      entityType: "user",
      entityId: target.id,
      before: { globalRole: target.globalRole },
      after: { globalRole: input.role, email: target.email },
    });
    await enqueue(tx, {
      userId: target.id,
      locale: target.preferredLocale,
      type: "ROLE_CHANGED",
      payload: { role: input.role, byName: actor.fullName },
    });
    return updated;
  });
}

/**
 * Creates (or reuses) an account for an email, sets the profile, approves memberships
 * for the given sites and emails the person. Auth user creation is delegated so tests can stub it.
 */
export async function inviteUser(
  actor: Actor,
  input: InviteUserInput,
  authAdmin: AuthAdmin,
): Promise<{ user: User; created: boolean }> {
  requireAdmin(actor);
  const sites = input.siteIds.length
    ? await db.query.sites.findMany({ where: inArray(schema.sites.id, input.siteIds) })
    : [];
  if (sites.length !== input.siteIds.length) throw notFound("site");
  const auth = await authAdmin.ensureAuthUser(input.email);

  return db.transaction(async (tx) => {
    let user = await tx.query.users.findFirst({ where: eq(schema.users.id, auth.id) });
    let created = false;
    if (!user) {
      const byEmail = await tx.query.users.findFirst({ where: eq(schema.users.email, input.email) });
      if (byEmail && byEmail.id !== auth.id) throw new AppError("ALREADY_EXISTS", "Email belongs to another account");
      [user] = await tx
        .insert(schema.users)
        .values({
          id: auth.id,
          email: input.email,
          fullName: input.fullName,
          preferredLocale: input.locale,
          globalRole: input.role,
        })
        .returning();
      created = true;
    } else {
      if (user.status !== "ACTIVE") throw forbidden("User disabled");
      [user] = await tx
        .update(schema.users)
        .set({
          fullName: user.fullName ?? input.fullName,
          preferredLocale: user.fullName ? user.preferredLocale : input.locale,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id))
        .returning();
    }
    for (const site of sites) {
      const existing = await tx.query.siteMemberships.findFirst({
        where: and(eq(schema.siteMemberships.siteId, site.id), eq(schema.siteMemberships.userId, user.id)),
      });
      if (existing?.status === "APPROVED") continue;
      const row = existing
        ? (
            await tx
              .update(schema.siteMemberships)
              .set({ status: "APPROVED", decidedAt: new Date(), decidedBy: actor.userId })
              .where(eq(schema.siteMemberships.id, existing.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(schema.siteMemberships)
              .values({
                siteId: site.id,
                userId: user.id,
                status: "APPROVED",
                decidedAt: new Date(),
                decidedBy: actor.userId,
              })
              .returning()
          )[0];
      await audit(tx, {
        actor,
        siteId: site.id,
        action: "MEMBERSHIP_DECIDED",
        entityType: "membership",
        entityId: row.id,
        before: existing ? { status: existing.status } : null,
        after: { status: "APPROVED", userId: user.id, invited: true },
      });
    }
    await audit(tx, {
      actor,
      action: "USER_INVITED",
      entityType: "user",
      entityId: user.id,
      after: { email: user.email, created, role: user.globalRole, siteIds: sites.map((s) => s.id) },
    });
    if (created && input.role === "SUPER_ADMIN") {
      await audit(tx, {
        actor,
        action: "ROLE_GRANTED",
        entityType: "user",
        entityId: user.id,
        after: { globalRole: "SUPER_ADMIN", email: user.email },
      });
    }
    await enqueue(tx, {
      userId: user.id,
      locale: user.preferredLocale,
      type: "USER_INVITED",
      payload: {
        inviterName: actor.fullName ?? actor.email,
        siteNames: sites.map((s) => s.name),
        role: user.globalRole,
      },
    });
    return { user, created };
  });
}

async function assertNotLastManager(tx: Tx, target: User): Promise<void> {
  if (target.globalRole !== "SUPER_ADMIN" || target.status !== "ACTIVE") return;
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users)
    .where(and(eq(schema.users.globalRole, "SUPER_ADMIN"), eq(schema.users.status, "ACTIVE")));
  if (count <= 1) throw new AppError("LAST_ADMIN", "Cannot remove the last manager");
}

/** Manager edits another user's name, email and language. Email changes propagate to the sign-in account. */
export async function updateUser(actor: Actor, input: UpdateUserInput, authAdmin: AuthAdmin): Promise<User> {
  requireAdmin(actor);
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, input.userId) });
  if (!target) throw notFound("user");
  if (target.email !== input.email) {
    const clash = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
    if (clash) throw new AppError("ALREADY_EXISTS", "Email already in use");
    await authAdmin.updateEmail(target.id, input.email);
  }
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.users)
      .set({ fullName: input.fullName, email: input.email, preferredLocale: input.locale, updatedAt: new Date() })
      .where(eq(schema.users.id, target.id))
      .returning();
    await audit(tx, {
      actor,
      action: "USER_UPDATED",
      entityType: "user",
      entityId: target.id,
      before: { fullName: target.fullName, email: target.email, preferredLocale: target.preferredLocale },
      after: { fullName: updated.fullName, email: updated.email, preferredLocale: updated.preferredLocale },
    });
    return updated;
  });
}

/** Disable (blocks sign-in use of the app) or re-enable. Not for yourself or the last manager. */
export async function setUserStatus(actor: Actor, input: SetUserStatusInput): Promise<User> {
  requireAdmin(actor);
  if (input.userId === actor.userId) throw validation({ userId: "cannot change your own status" });
  return db.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: eq(schema.users.id, input.userId) });
    if (!target) throw notFound("user");
    if (target.status === input.status) return target;
    if (input.status === "DISABLED") await assertNotLastManager(tx, target);
    const [updated] = await tx
      .update(schema.users)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(schema.users.id, target.id))
      .returning();
    await audit(tx, {
      actor,
      action: "USER_STATUS_SET",
      entityType: "user",
      entityId: target.id,
      before: { status: target.status },
      after: { status: input.status },
    });
    return updated;
  });
}

export type DeleteUserResult = { mode: "HARD" | "ANONYMIZED"; cancelledBookings: number; cancelledSeries: number };

/**
 * Deletes a user. With no bookings/series the row is removed entirely; otherwise the user is
 * disabled and anonymized, future bookings and active series are cancelled, memberships suspended.
 * The sign-in account is deleted in both cases.
 */
export async function deleteUser(actor: Actor, userId: string, authAdmin: AuthAdmin): Promise<DeleteUserResult> {
  requireAdmin(actor);
  if (userId === actor.userId) throw validation({ userId: "cannot delete yourself" });
  const result = await db.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!target) throw notFound("user");
    await assertNotLastManager(tx, target);
    const now = new Date();
    const hasBookings = (await tx.$count(schema.bookings, eq(schema.bookings.userId, userId))) > 0;
    const hasSeries = (await tx.$count(schema.recurrenceSeries, eq(schema.recurrenceSeries.userId, userId))) > 0;
    if (!hasBookings && !hasSeries) {
      await tx.delete(schema.notifications).where(eq(schema.notifications.userId, userId));
      await tx.delete(schema.siteMemberships).where(eq(schema.siteMemberships.userId, userId));
      await tx
        .update(schema.siteMemberships)
        .set({ decidedBy: null })
        .where(eq(schema.siteMemberships.decidedBy, userId));
      await tx.update(schema.auditEvents).set({ actorUserId: null }).where(eq(schema.auditEvents.actorUserId, userId));
      await tx.update(schema.closures).set({ createdBy: actor.userId }).where(eq(schema.closures.createdBy, userId));
      await tx
        .update(schema.recurrenceSeries)
        .set({ createdBy: actor.userId })
        .where(eq(schema.recurrenceSeries.createdBy, userId));
      await tx
        .update(schema.recurrenceSeries)
        .set({ updatedBy: actor.userId })
        .where(eq(schema.recurrenceSeries.updatedBy, userId));
      await tx.update(schema.bookings).set({ createdBy: actor.userId }).where(eq(schema.bookings.createdBy, userId));
      await tx.update(schema.bookings).set({ updatedBy: actor.userId }).where(eq(schema.bookings.updatedBy, userId));
      await tx
        .update(schema.bookings)
        .set({ cancelledBy: actor.userId })
        .where(eq(schema.bookings.cancelledBy, userId));
      await tx.delete(schema.users).where(eq(schema.users.id, userId));
      await audit(tx, {
        actor,
        action: "USER_DELETED_HARD",
        entityType: "user",
        entityId: userId,
        before: { email: target.email, fullName: target.fullName },
      });
      return { mode: "HARD" as const, cancelledBookings: 0, cancelledSeries: 0 };
    }
    const cancelled = await tx
      .update(schema.bookings)
      .set({
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor.userId,
        cancellationReason: "USER_DELETED",
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.bookings.userId, userId),
          eq(schema.bookings.status, "CONFIRMED"),
          gte(schema.bookings.startAt, now),
        ),
      )
      .returning({ id: schema.bookings.id });
    const series = await tx
      .update(schema.recurrenceSeries)
      .set({ status: "CANCELLED", updatedBy: actor.userId, updatedAt: now })
      .where(and(eq(schema.recurrenceSeries.userId, userId), eq(schema.recurrenceSeries.status, "ACTIVE")))
      .returning({ id: schema.recurrenceSeries.id });
    await tx
      .update(schema.siteMemberships)
      .set({ status: "SUSPENDED", decidedAt: now, decidedBy: actor.userId })
      .where(
        and(
          eq(schema.siteMemberships.userId, userId),
          or(eq(schema.siteMemberships.status, "APPROVED"), eq(schema.siteMemberships.status, "PENDING")),
        ),
      );
    await tx
      .delete(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.status, "PENDING")));
    await tx
      .update(schema.users)
      .set({
        status: "DISABLED",
        globalRole: "THERAPIST",
        fullName: "משתמש שהוסר",
        email: `deleted+${userId}@invalid`,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userId));
    await audit(tx, {
      actor,
      action: "USER_DELETED",
      entityType: "user",
      entityId: userId,
      before: { email: target.email, fullName: target.fullName, status: target.status },
      after: { status: "DISABLED", cancelledBookings: cancelled.length, cancelledSeries: series.length },
    });
    return { mode: "ANONYMIZED" as const, cancelledBookings: cancelled.length, cancelledSeries: series.length };
  });
  await authAdmin.deleteAuthUser(userId);
  return result;
}
