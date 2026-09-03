import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAdminPage } from "../../../guards";
import { AdminShell } from "../../admin-shell";
import { getSeries } from "@/modules/recurrence/service";
import { listRooms } from "@/modules/rooms/service";
import { listApprovedMembers } from "@/modules/memberships/service";
import { SeriesDetail } from "./series-detail";
import { isAppError } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { todayLocal } from "@/lib/time";
import { Link } from "@/i18n/navigation";

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locale, id } = await params;
  const { from } = await searchParams;
  const actor = await requireAdminPage();
  let series;
  try {
    series = await getSeries(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, series.siteId) });
  if (!site) notFound();
  const [rooms, members] = await Promise.all([
    listRooms(actor, series.siteId),
    listApprovedMembers(actor, series.siteId),
  ]);
  const t = await getTranslations("admin.series");

  return (
    <AdminShell actor={actor} currentSiteId={series.siteId}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/admin/series" className="text-sm underline">
          {t("back")}
        </Link>
      </div>
      <SeriesDetail
        series={{
          id: series.id,
          siteId: series.siteId,
          siteName: series.siteName,
          timezone: site.timezone,
          roomId: series.roomId,
          roomNumber: series.roomNumber,
          userId: series.userId,
          userName: series.userName ?? series.userEmail,
          weekday: series.weekday,
          startTime: series.startTime.slice(0, 5),
          endTime: series.endTime.slice(0, 5),
          startsOn: series.startsOn,
          endsOn: series.endsOn,
          note: series.note,
          status: series.status,
          occurrences: series.occurrences.map((o) => ({
            ...o,
            startAt: o.startAt.toISOString(),
            endAt: o.endAt.toISOString(),
          })),
        }}
        rooms={rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber }))}
        members={members}
        today={todayLocal(site.timezone)}
        locale={locale}
        defaultFromDate={from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined}
      />
    </AdminShell>
  );
}
