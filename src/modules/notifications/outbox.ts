import { eq } from "drizzle-orm";
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
  | "OCCURRENCE_CANCELLED_BY_THERAPIST";

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

/** Resolves the super admin as a recipient (id + locale), or null if none exists. */
export async function superAdminRecipient(tx: Tx): Promise<{ userId: string; locale: string } | null> {
  const admin = await tx.query.users.findFirst({ where: eq(schema.users.globalRole, "SUPER_ADMIN") });
  return admin ? { userId: admin.id, locale: admin.preferredLocale } : null;
}
