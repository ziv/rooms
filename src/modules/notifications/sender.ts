import "server-only";
import nodemailer from "nodemailer";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { renderEmail } from "./templates";
import { buildIcs } from "@/modules/ics/build";
import type { NotificationType } from "./outbox";

export const MAX_ATTEMPTS = 5;

export type Mailer = (msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}) => Promise<void>;

let cachedTransport: nodemailer.Transporter | null = null;
function defaultMailer(): Mailer | null {
  const e = env();
  if (!e.GMAIL_USER || !e.GMAIL_APP_PASSWORD) return null;
  cachedTransport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: e.GMAIL_USER, pass: e.GMAIL_APP_PASSWORD },
  });
  const from = e.EMAIL_FROM ?? e.GMAIL_USER;
  return async (msg) => {
    await cachedTransport!.sendMail({ from, ...msg });
  };
}

/**
 * Sends pending/failed notifications (attempts < MAX). Rows are claimed with
 * `FOR UPDATE SKIP LOCKED` so concurrent flushes never double-send.
 * Returns counts. Safe to call from `after()` and from the cron route.
 */
export async function flushNotifications(
  opts: { limit?: number; mailer?: Mailer } = {},
): Promise<{ sent: number; failed: number; skipped: number }> {
  const mailer = opts.mailer ?? defaultMailer();
  if (!mailer) return { sent: 0, failed: 0, skipped: 0 };
  const limit = opts.limit ?? 20;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Claim a batch atomically.
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          inArray(schema.notifications.status, ["PENDING", "FAILED"]),
          lt(schema.notifications.attempts, MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(schema.notifications.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await tx
      .update(schema.notifications)
      .set({ attempts: sql`${schema.notifications.attempts} + 1` })
      .where(inArray(schema.notifications.id, ids));
    return tx
      .select({ n: schema.notifications, email: schema.users.email, userStatus: schema.users.status })
      .from(schema.notifications)
      .innerJoin(schema.users, eq(schema.users.id, schema.notifications.userId))
      .where(inArray(schema.notifications.id, ids));
  });

  for (const { n, email, userStatus } of claimed) {
    if (userStatus !== "ACTIVE" || !email.includes("@") || email.endsWith("@invalid")) {
      await db
        .update(schema.notifications)
        .set({ status: "SENT", sentAt: new Date(), lastError: "recipient disabled" })
        .where(eq(schema.notifications.id, n.id));
      skipped++;
      continue;
    }
    try {
      const rendered = renderEmail(
        n.type as NotificationType,
        n.locale,
        n.payload as Record<string, unknown>,
        env().APP_URL,
      );
      const attachments = rendered.icsBookingId ? await icsAttachment(rendered.icsBookingId, n.locale) : undefined;
      await mailer({ to: email, subject: rendered.subject, html: rendered.html, text: rendered.text, attachments });
      await db
        .update(schema.notifications)
        .set({ status: "SENT", sentAt: new Date(), lastError: null })
        .where(eq(schema.notifications.id, n.id));
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db
        .update(schema.notifications)
        .set({ status: "FAILED", lastError: message.slice(0, 500) })
        .where(eq(schema.notifications.id, n.id));
      failed++;
      if (n.attempts + 1 >= MAX_ATTEMPTS)
        Sentry.captureMessage(`notification ${n.id} failed ${MAX_ATTEMPTS} times: ${message}`, "error");
    }
  }
  return { sent, failed, skipped };
}

async function icsAttachment(bookingId: string, locale: string) {
  const row = await db
    .select({
      b: schema.bookings,
      siteName: schema.sites.name,
      siteAddress: schema.sites.address,
      timezone: schema.sites.timezone,
      roomNumber: schema.rooms.roomNumber,
    })
    .from(schema.bookings)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.bookings.siteId))
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.bookings.roomId))
    .where(eq(schema.bookings.id, bookingId))
    .then((r) => r[0]);
  if (!row) return undefined;
  const roomWord = locale === "en" ? "Room" : "חדר";
  const ics = buildIcs({
    uid: `${row.b.id}@rooms`,
    sequence: row.b.version,
    startAt: row.b.startAt,
    endAt: row.b.endAt,
    timezone: row.timezone,
    summary: `${roomWord} ${row.roomNumber} · ${row.siteName}`,
    location: row.siteAddress,
    url: `${env().APP_URL}/${locale}/bookings/${row.b.id}`,
    cancelled: row.b.status === "CANCELLED",
    createdAt: row.b.createdAt,
    updatedAt: row.b.updatedAt,
  });
  return [
    {
      filename: "booking.ics",
      content: ics,
      contentType: `text/calendar; charset=utf-8; method=${row.b.status === "CANCELLED" ? "CANCEL" : "PUBLISH"}`,
    },
  ];
}
