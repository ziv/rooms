import "server-only";
import { desc, eq, and, type SQL } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import type { Actor } from "@/modules/auth/actor";
import { requireAdmin } from "@/modules/auth/guards";

export type AuditAction =
  | "ROLE_GRANTED"
  | "ROLE_REVOKED"
  | "USER_INVITED"
  | "MEMBERSHIP_REQUESTED"
  | "MEMBERSHIP_DECIDED"
  | "SITE_UPDATED"
  | "OPENING_HOURS_SET"
  | "ROOM_CREATED"
  | "ROOM_UPDATED"
  | "ROOMS_REORDERED"
  | "CLOSURE_CREATED"
  | "CLOSURE_DELETED"
  | "BOOKING_CREATED"
  | "BOOKING_MOVED"
  | "BOOKING_CANCELLED"
  | "SERIES_CREATED"
  | "SERIES_SPLIT"
  | "SERIES_CANCELLED"
  | "USER_DELETED";

export type AuditInput = {
  actor: Actor | null;
  siteId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Writes one audit event inside the caller's transaction. */
export async function audit(tx: Tx, input: AuditInput): Promise<void> {
  await tx.insert(schema.auditEvents).values({
    siteId: input.siteId ?? null,
    actorUserId: input.actor && input.actor.requestId !== "system" ? input.actor.userId : null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.actor?.requestId ?? null,
  });
}

export type AuditFilter = { siteId?: string; entityType?: string; limit?: number; offset?: number };

export async function listAuditEvents(actor: Actor, filter: AuditFilter = {}) {
  requireAdmin(actor);
  const conds: SQL[] = [];
  if (filter.siteId) conds.push(eq(schema.auditEvents.siteId, filter.siteId));
  if (filter.entityType) conds.push(eq(schema.auditEvents.entityType, filter.entityType));
  return db
    .select({
      id: schema.auditEvents.id,
      siteId: schema.auditEvents.siteId,
      actorUserId: schema.auditEvents.actorUserId,
      actorName: schema.users.fullName,
      action: schema.auditEvents.action,
      entityType: schema.auditEvents.entityType,
      entityId: schema.auditEvents.entityId,
      before: schema.auditEvents.before,
      after: schema.auditEvents.after,
      requestId: schema.auditEvents.requestId,
      createdAt: schema.auditEvents.createdAt,
    })
    .from(schema.auditEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditEvents.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(filter.limit ?? 100)
    .offset(filter.offset ?? 0);
}
