import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/modules/auth/actor";
import type { UpdateProfileInput } from "@/lib/validation/users";
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
