import type { NotificationType } from "../outbox";

export type RenderedEmail = { subject: string; html: string; text: string; icsBookingId?: string };
type Payload = Record<string, unknown>;

const L = {
  he: {
    dir: "rtl",
    site: "מתחם",
    room: "חדר",
    date: "תאריך",
    time: "שעה",
    open: "לפרטי ההזמנה",
    footer: "הודעה אוטומטית ממערכת תיאום החדרים. אין להשיב להודעה זו.",
    MEMBERSHIP_REQUESTED: {
      subject: "בקשת הצטרפות חדשה",
      title: "בקשת הצטרפות חדשה",
      body: "{userName} ({userEmail}) ביקש/ה להצטרף למתחם {siteName}.",
      cta: "לניהול מטפלים",
    },
    MEMBERSHIP_DECIDED: {
      subject: "עדכון בבקשת ההצטרפות שלך",
      title: "בקשת ההצטרפות שלך עודכנה",
      body: "מצב החברות שלך במתחם {siteName}: {status}.",
      cta: "ליומן",
    },
    BOOKING_CREATED: {
      subject: "אישור הזמנת חדר",
      title: "ההזמנה נשמרה",
      body: "ההזמנה שלך אושרה.",
      cta: "לפרטי ההזמנה",
    },
    BOOKING_CHANGED_BY_ADMIN: {
      subject: "ההזמנה שלך שונתה",
      title: "ההזמנה שלך שונתה בידי המנהל",
      body: "המועד או החדר של ההזמנה שלך עודכנו. הפרטים המעודכנים:",
      cta: "לפרטי ההזמנה",
    },
    BOOKING_CANCELLED_BY_ADMIN: {
      subject: "ההזמנה שלך בוטלה",
      title: "ההזמנה שלך בוטלה בידי המנהל",
      body: "ההזמנה הבאה בוטלה. {reason}",
      cta: "ליומן",
    },
    BOOKING_CANCELLED_BY_CLOSURE: {
      subject: "ההזמנה שלך בוטלה עקב סגירה",
      title: "ההזמנה שלך בוטלה עקב סגירה",
      body: "החדר נסגר במועד ההזמנה שלך והיא בוטלה. {reason}",
      cta: "ליומן",
    },
    SERIES_CREATED: {
      subject: "ססיה שבועית נקבעה עבורך",
      title: "ססיה שבועית נקבעה",
      body: "נקבעה לך ססיה שבועית: יום {weekday}, {startTime}–{endTime}, מ-{startsOn} עד {endsOn}. נוצרו {created} מופעים. {skippedText}",
      cta: "להזמנות שלי",
    },
    SERIES_CHANGED: {
      subject: "הססיה השבועית שלך שונתה",
      title: "הססיה השבועית שלך שונתה",
      body: "מתאריך {fromDate}: יום {weekday}, {startTime}–{endTime}, עד {endsOn}. נוצרו {created} מופעים. {skippedText}",
      cta: "להזמנות שלי",
    },
    SERIES_CANCELLED: {
      subject: "הססיה השבועית שלך בוטלה",
      title: "הססיה השבועית שלך בוטלה",
      body: "הססיה ביום {weekday} {startTime}–{endTime} בוטלה. {reason}",
      cta: "ליומן",
    },
    OCCURRENCE_CANCELLED_BY_THERAPIST: {
      subject: "מטפל/ת ביטל/ה מופע ססיה",
      title: "מופע ססיה בוטל",
      body: "{userName} ביטל/ה את המופע הבא:",
      cta: "לפרטי ההזמנה",
    },
    USER_INVITED: {
      subject: "נפתח לך חשבון במערכת תיאום החדרים",
      title: "נפתח לך חשבון",
      body: "{inviterName} פתח/ה לך חשבון במערכת תיאום החדרים{siteText}. להתחברות: היכנס/י לכתובת למטה עם כתובת הדוא״ל הזו (קוד בדוא״ל) או עם חשבון Google באותה כתובת.",
      cta: "כניסה למערכת",
    },
    ROLE_CHANGED: { subject: "עדכון הרשאות", title: "ההרשאות שלך עודכנו", body: "{roleText}", cta: "כניסה למערכת" },
    roleAdmin: "מונית/ה למנהל/ת במערכת תיאום החדרים. כעת יש לך גישה לכל המתחמים, לניהול המטפלים ולדוחות.",
    roleTherapist: "הרשאת הניהול שלך הוסרה. החשבון ממשיך לפעול כמטפל/ת.",
    sitesText: " ואושר/ה במתחמים: {sites}",
    status: { APPROVED: "מאושר", REJECTED: "נדחה", SUSPENDED: "מושעה", PENDING: "ממתין" },
    reason: "סיבה: {reason}",
    skipped: "מופעים שדולגו עקב התנגשות: {dates}.",
    weekdays: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  },
  en: {
    dir: "ltr",
    site: "Site",
    room: "Room",
    date: "Date",
    time: "Time",
    open: "Open booking",
    footer: "Automatic message from the room scheduler. Do not reply.",
    MEMBERSHIP_REQUESTED: {
      subject: "New membership request",
      title: "New membership request",
      body: "{userName} ({userEmail}) asked to join {siteName}.",
      cta: "Manage therapists",
    },
    MEMBERSHIP_DECIDED: {
      subject: "Your membership request was updated",
      title: "Your membership request was updated",
      body: "Your membership status at {siteName}: {status}.",
      cta: "Open calendar",
    },
    BOOKING_CREATED: {
      subject: "Room booking confirmed",
      title: "Booking saved",
      body: "Your booking is confirmed.",
      cta: "Open booking",
    },
    BOOKING_CHANGED_BY_ADMIN: {
      subject: "Your booking was changed",
      title: "Your booking was changed by the manager",
      body: "The time or room of your booking was updated. Updated details:",
      cta: "Open booking",
    },
    BOOKING_CANCELLED_BY_ADMIN: {
      subject: "Your booking was cancelled",
      title: "Your booking was cancelled by the manager",
      body: "The following booking was cancelled. {reason}",
      cta: "Open calendar",
    },
    BOOKING_CANCELLED_BY_CLOSURE: {
      subject: "Your booking was cancelled due to a closure",
      title: "Your booking was cancelled due to a closure",
      body: "The room is closed at the time of your booking, so it was cancelled. {reason}",
      cta: "Open calendar",
    },
    SERIES_CREATED: {
      subject: "A weekly series was set for you",
      title: "Weekly series created",
      body: "A weekly series was set for you: {weekday}, {startTime}–{endTime}, from {startsOn} to {endsOn}. {created} occurrences were created. {skippedText}",
      cta: "My bookings",
    },
    SERIES_CHANGED: {
      subject: "Your weekly series was changed",
      title: "Your weekly series was changed",
      body: "From {fromDate}: {weekday}, {startTime}–{endTime}, until {endsOn}. {created} occurrences were created. {skippedText}",
      cta: "My bookings",
    },
    SERIES_CANCELLED: {
      subject: "Your weekly series was cancelled",
      title: "Your weekly series was cancelled",
      body: "The series on {weekday} {startTime}–{endTime} was cancelled. {reason}",
      cta: "Open calendar",
    },
    OCCURRENCE_CANCELLED_BY_THERAPIST: {
      subject: "A therapist cancelled a series occurrence",
      title: "Series occurrence cancelled",
      body: "{userName} cancelled the following occurrence:",
      cta: "Open booking",
    },
    USER_INVITED: {
      subject: "An account was created for you",
      title: "An account was created for you",
      body: "{inviterName} created an account for you in the room scheduler{siteText}. To sign in, open the link below with this email address (a code is emailed) or with a Google account on the same address.",
      cta: "Sign in",
    },
    ROLE_CHANGED: {
      subject: "Your permissions were updated",
      title: "Your permissions were updated",
      body: "{roleText}",
      cta: "Sign in",
    },
    roleAdmin:
      "You were made a manager of the room scheduler. You now have access to all sites, therapist management and reports.",
    roleTherapist: "Your manager permission was removed. Your account continues as a therapist.",
    sitesText: " and approved at: {sites}",
    status: { APPROVED: "approved", REJECTED: "rejected", SUSPENDED: "suspended", PENDING: "pending" },
    reason: "Reason: {reason}",
    skipped: "Occurrences skipped due to conflicts: {dates}.",
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
} as const;

type Lang = keyof typeof L;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fill = (tpl: string, vars: Record<string, unknown>) =>
  tpl
    .replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""))
    .replace(/\s{2,}/g, " ")
    .trim();

function fmtDate(iso: unknown, tz: string, lang: Lang) {
  if (typeof iso !== "string") return "";
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { dateStyle: "full", timeZone: tz }).format(
    new Date(iso),
  );
}
function fmtTime(iso: unknown, tz: string) {
  if (typeof iso !== "string") return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(
    new Date(iso),
  );
}

export function renderEmail(type: NotificationType, locale: string, payload: Payload, appUrl: string): RenderedEmail {
  const lang: Lang = locale === "en" ? "en" : "he";
  const l = L[lang];
  const tpl = l[type];
  const tz = typeof payload.timezone === "string" ? payload.timezone : "Asia/Jerusalem";
  const vars: Record<string, unknown> = {
    ...payload,
    status:
      typeof payload.status === "string"
        ? ((l.status as Record<string, string>)[payload.status] ?? payload.status)
        : "",
    weekday: typeof payload.weekday === "number" ? l.weekdays[payload.weekday] : "",
    reason: payload.reason ? fill(l.reason, { reason: payload.reason }) : "",
    skippedText:
      Array.isArray(payload.skipped) && payload.skipped.length
        ? fill(l.skipped, { dates: (payload.skipped as string[]).join(", ") })
        : "",
  };
  const body = fill(tpl.body, vars);
  const hasBooking = typeof payload.startAt === "string" && typeof payload.roomNumber !== "undefined";
  const link =
    type === "USER_INVITED" || type === "ROLE_CHANGED"
      ? `${appUrl}/${lang}/login`
      : type === "MEMBERSHIP_REQUESTED"
        ? `${appUrl}/${lang}/admin/members?status=PENDING`
        : typeof payload.bookingId === "string"
          ? `${appUrl}/${lang}/bookings/${payload.bookingId}`
          : type.startsWith("SERIES")
            ? `${appUrl}/${lang}/bookings`
            : `${appUrl}/${lang}/calendar`;

  const detailRows = hasBooking
    ? [
        [l.site, `${payload.siteName ?? ""}${payload.siteAddress ? ` · ${payload.siteAddress}` : ""}`],
        [l.room, payload.roomNumber],
        [l.date, fmtDate(payload.startAt, tz, lang)],
        [l.time, `${fmtTime(payload.startAt, tz)}–${fmtTime(payload.endAt, tz)}`],
      ]
    : payload.siteName
      ? [[l.site, payload.siteName]]
      : [];

  const text = [
    tpl.title,
    "",
    body,
    ...detailRows.map(([k, v]) => `${k}: ${v}`),
    "",
    `${tpl.cta}: ${link}`,
    "",
    l.footer,
  ].join("\n");
  const html = `<!doctype html><html lang="${lang}" dir="${l.dir}"><body style="font-family:system-ui,Arial,sans-serif;background:#f6f6f6;padding:24px;direction:${l.dir}">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e5e5">
<h2 style="margin:0 0 12px;font-size:20px">${esc(tpl.title)}</h2>
<p style="margin:0 0 16px;line-height:1.5">${esc(body)}</p>
${detailRows.length ? `<table style="border-collapse:collapse;margin:0 0 16px">${detailRows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0"><bdi>${esc(v)}</bdi></td></tr>`).join("")}</table>` : ""}
<p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">${esc(tpl.cta)}</a></p>
<p style="color:#888;font-size:12px;margin-top:24px">${esc(l.footer)}</p>
</div></body></html>`;

  const attachIcs =
    hasBooking &&
    typeof payload.bookingId === "string" &&
    [
      "BOOKING_CREATED",
      "BOOKING_CHANGED_BY_ADMIN",
      "BOOKING_CANCELLED_BY_ADMIN",
      "BOOKING_CANCELLED_BY_CLOSURE",
    ].includes(type);
  return { subject: tpl.subject, html, text, icsBookingId: attachIcs ? (payload.bookingId as string) : undefined };
}
