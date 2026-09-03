import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getActor } from "@/modules/auth/current";
import { isAdmin } from "@/modules/auth/actor";
import { bookingsDetail, hoursSummary } from "@/modules/reports/service";
import { parseFilter } from "@/app/[locale]/(app)/admin/reports/filters";
import { toCsv } from "@/lib/csv";
import { utcToLocal } from "@/lib/time";

const TZ = "Asia/Jerusalem";

export async function GET(req: Request, ctx: { params: Promise<{ report: string }> }) {
  const { report } = await ctx.params;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin(actor)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const url = new URL(req.url);
  const filter = parseFilter(Object.fromEntries(url.searchParams));
  const t = await getTranslations({ locale: actor.locale, namespace: "admin.reports" });

  let csv: string;
  if (report === "hours") {
    const s = await hoursSummary(actor, filter);
    csv = toCsv(
      [t("byTherapist"), t("site"), t("regular"), t("series"), t("total"), t("bookings")],
      [
        ...s.byTherapist.map((r) => [
          r.label,
          "",
          r.regularHours.toFixed(2),
          r.seriesHours.toFixed(2),
          r.totalHours.toFixed(2),
          r.bookings,
        ]),
        [],
        [t("byRoom"), "", "", "", "", ""],
        ...s.byRoom.map((r) => [
          r.label,
          r.siteName,
          r.regularHours.toFixed(2),
          r.seriesHours.toFixed(2),
          r.totalHours.toFixed(2),
          r.bookings,
        ]),
      ],
    );
  } else if (report === "bookings") {
    const rows = await bookingsDetail(actor, filter, { limit: 10_000, offset: 0 });
    csv = toCsv(
      [
        t("date"),
        t("time"),
        t("site"),
        t("room"),
        t("therapist"),
        "email",
        t("type"),
        t("status"),
        t("createdBy"),
        t("cancelledBy"),
        t("cancelledAt"),
        t("reason"),
        t("note"),
      ],
      rows.map((r) => {
        const s = utcToLocal(r.startAt, TZ);
        const e = utcToLocal(r.endAt, TZ);
        const c = r.cancelledAt ? utcToLocal(r.cancelledAt, TZ) : null;
        return [
          s.date,
          `${s.time}-${e.time}`,
          r.siteName,
          r.roomNumber,
          r.userName,
          r.userEmail,
          r.bookingType,
          r.status,
          r.createdByName,
          r.cancelledByName,
          c ? `${c.date} ${c.time}` : "",
          r.cancellationReason,
          r.note,
        ];
      }),
    );
  } else {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${report}-${filter.from}-${filter.to}.csv`)}`,
      "Cache-Control": "no-store",
    },
  });
}
