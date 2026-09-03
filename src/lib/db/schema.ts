import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------- enums ----------
export const globalRole = pgEnum("global_role", ["THERAPIST", "SUPER_ADMIN"]);
export const userStatus = pgEnum("user_status", ["ACTIVE", "DISABLED"]);
export const membershipStatus = pgEnum("membership_status", ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]);
export const activeStatus = pgEnum("active_status", ["ACTIVE", "INACTIVE"]);
export const bookingType = pgEnum("booking_type", ["REGULAR", "SERIES"]);
export const bookingStatus = pgEnum("booking_status", ["CONFIRMED", "CANCELLED"]);
export const seriesStatus = pgEnum("series_status", ["ACTIVE", "ENDED", "CANCELLED"]);
export const notificationStatus = pgEnum("notification_status", ["PENDING", "SENT", "FAILED"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------- users ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // = auth.users.id
    email: text("email").notNull(),
    fullName: text("full_name"),
    preferredLocale: text("preferred_locale").notNull().default("he"),
    globalRole: globalRole("global_role").notNull().default("THERAPIST"),
    status: userStatus("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    check("users_locale_check", sql`${t.preferredLocale} in ('he', 'en')`),
    // exactly one super admin (partial unique index on a constant expression)
    uniqueIndex("users_single_super_admin")
      .on(sql`(true)`)
      .where(sql`${t.globalRole} = 'SUPER_ADMIN'`),
  ],
);

// ---------- sites ----------
export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    timezone: text("timezone").notNull().default("Asia/Jerusalem"),
    bookingWindowDays: integer("booking_window_days").notNull().default(90),
    cancellationCutoffMinutes: integer("cancellation_cutoff_minutes").notNull().default(0),
    status: activeStatus("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [
    check("sites_window_check", sql`${t.bookingWindowDays} between 1 and 365`),
    check("sites_cutoff_check", sql`${t.cancellationCutoffMinutes} >= 0`),
  ],
);

// ---------- site_memberships ----------
export const siteMemberships = pgTable(
  "site_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: membershipStatus("status").notNull().default("PENDING"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("site_memberships_site_user_unique").on(t.siteId, t.userId),
    index("site_memberships_site_status").on(t.siteId, t.status),
  ],
);

// ---------- rooms ----------
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    roomNumber: text("room_number").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    status: activeStatus("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [uniqueIndex("rooms_site_number_unique").on(t.siteId, t.roomNumber)],
);

// ---------- opening_hours ----------
export const openingHours = pgTable(
  "opening_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    weekday: smallint("weekday").notNull(), // 0 = Sunday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    uniqueIndex("opening_hours_site_weekday_start_unique").on(t.siteId, t.weekday, t.startTime),
    check("opening_hours_weekday_check", sql`${t.weekday} between 0 and 6`),
    check("opening_hours_range_check", sql`${t.startTime} < ${t.endTime}`),
  ],
);

// ---------- closures ----------
export const closures = pgTable(
  "closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    roomId: uuid("room_id").references(() => rooms.id), // null = whole site
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("closures_range_check", sql`${t.startAt} < ${t.endAt}`),
    index("closures_site_start").on(t.siteId, t.startAt),
  ],
);

// ---------- recurrence_series ----------
export const recurrenceSeries = pgTable(
  "recurrence_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    note: text("note"),
    status: seriesStatus("status").notNull().default("ACTIVE"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    check("series_weekday_check", sql`${t.weekday} between 0 and 6`),
    check("series_time_check", sql`${t.startTime} < ${t.endTime}`),
    check("series_dates_check", sql`${t.endsOn} >= ${t.startsOn} and ${t.endsOn} <= ${t.startsOn} + 364`),
    index("series_site_status").on(t.siteId, t.status),
  ],
);

// ---------- bookings ----------
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey(), // client-generated
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    bookingType: bookingType("booking_type").notNull(),
    status: bookingStatus("status").notNull().default("CONFIRMED"),
    note: text("note"),
    seriesId: uuid("series_id").references(() => recurrenceSeries.id),
    isException: boolean("is_exception").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancellationReason: text("cancellation_reason"),
    ...timestamps,
  },
  (t) => [
    check("bookings_range_check", sql`${t.startAt} < ${t.endAt}`),
    check("bookings_series_type_check", sql`(${t.bookingType} = 'SERIES') = (${t.seriesId} is not null)`),
    index("bookings_room_start").on(t.roomId, t.startAt),
    index("bookings_site_start").on(t.siteId, t.startAt),
    index("bookings_user_start").on(t.userId, t.startAt),
    index("bookings_series")
      .on(t.seriesId)
      .where(sql`${t.seriesId} is not null`),
    // NOTE: the EXCLUDE constraint (no overlapping CONFIRMED bookings per room)
    // is added in a custom migration; drizzle cannot express it.
  ],
);

// ---------- notifications ----------
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    locale: text("locale").notNull(),
    payload: jsonb("payload").notNull(),
    status: notificationStatus("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    index("notifications_pending")
      .on(t.createdAt)
      .where(sql`${t.status} <> 'SENT'`),
  ],
);

// ---------- audit_events ----------
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    siteId: uuid("site_id").references(() => sites.id),
    actorUserId: uuid("actor_user_id").references(() => users.id), // null = system
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_site_created").on(t.siteId, t.createdAt), index("audit_entity").on(t.entityType, t.entityId)],
);

// ---------- inferred types ----------
export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type SiteMembership = typeof siteMemberships.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type OpeningHour = typeof openingHours.$inferSelect;
export type Closure = typeof closures.$inferSelect;
export type RecurrenceSeries = typeof recurrenceSeries.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

export type GlobalRole = (typeof globalRole.enumValues)[number];
export type UserStatus = (typeof userStatus.enumValues)[number];
export type MembershipStatus = (typeof membershipStatus.enumValues)[number];
export type ActiveStatus = (typeof activeStatus.enumValues)[number];
export type BookingType = (typeof bookingType.enumValues)[number];
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type SeriesStatus = (typeof seriesStatus.enumValues)[number];
