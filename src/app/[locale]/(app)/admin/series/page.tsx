import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listSeries } from "@/modules/recurrence/service";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { SeriesTable } from "./series-table";

export default async function SeriesListPage() {
  const actor = await requireAdminPage();
  const rows = await listSeries(actor);
  const t = await getTranslations("admin.series");
  return (
    <AdminShell actor={actor}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Button nativeButton={false} render={<Link href="/admin/series/new" />}>
          {t("new")}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <SeriesTable
          rows={rows.map((s) => ({
            id: s.id,
            userName: s.userName,
            userEmail: s.userEmail,
            siteName: s.siteName,
            roomNumber: s.roomNumber,
            weekday: s.weekday,
            intervalWeeks: s.intervalWeeks,
            startTime: s.startTime.slice(0, 5),
            endTime: s.endTime.slice(0, 5),
            startsOn: s.startsOn,
            endsOn: s.endsOn,
            status: s.status,
          }))}
        />
      )}
    </AdminShell>
  );
}
