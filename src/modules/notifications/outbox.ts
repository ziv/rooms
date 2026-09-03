import { and, eq } from "drizzle-orm";
import { schema, type Tx } from "@/lib/db";

export type NotificationType =
  | "MEMBERSHIP_REQUESTED"
  | "MEMBERSHIP_DECIDED"
  | "BOOKING_CREATED"
  | "BOOKING_CHANGED_BY_ADMIN"
  | "BOOKING_CANCELLED_BY_ADMIN"
  | "BOOKING_CANCELLED_BY_CLOSURE"
  | "SERIES_CREATED"
  | "SERIES_CHANGED"
  | "SERIES_CANCELLED"
  | "OCCURRENCE_CANCELLED_BY_THERAPIST"
  | "USER_INVITED"
  | "ROLE_CHANGED";

export type EnqueueInput = {
  userId: string;
  locale: string;
  type: NotificationType;
  /** Self-contained payload: everything the template needs. Never patient data. */
  payload: Record<string, unknown>;
};

/** Writes an outbox row inside the caller's transaction. Sending happens later (M3). */
export async function enqueue(tx: Tx, input: EnqueueInput): Promise<void> {
  await tx.insert(schema.notifications).values({
    userId: input.userId,
    locale: input.locale,
    type: input.type,
    payload: input.payload,
  });
}

/** All active managers as recipients (id + locale). */
export async function adminRecipients(tx: Tx): Promise<{ userId: string; locale: string }[]> {
  const admins = await tx.query.users.findMany({
    where: and(eq(schema.users.globalRole, "SUPER_ADMIN"), eq(schema.users.status, "ACTIVE")),
  });
  return admins.map((a) => ({ userId: a.id, locale: a.preferredLocale }));
}

/** Enqueues the same notification for every manager. */
export async function enqueueForAdmins(
  tx: Tx,
  type: NotificationType,
  payload: Record<string, unknown>,
): Promise<void> {
  for (const a of await adminRecipients(tx)) await enqueue(tx, { userId: a.userId, locale: a.locale, type, payload });
}
