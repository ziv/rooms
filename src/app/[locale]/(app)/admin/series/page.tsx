import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listSeries } from "@/modules/recurrence/service";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SeriesListPage() {
  const actor = await requireAdminPage();
  const rows = await listSeries(actor);
  const t = await getTranslations("admin.series");
  const tw = await getTranslations("weekdays");
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("therapist")}</TableHead>
              <TableHead>{t("site")}</TableHead>
              <TableHead>{t("room")}</TableHead>
              <TableHead>{t("weekday")}</TableHead>
              <TableHead>{t("frequency")}</TableHead>
              <TableHead>{t("startTime")}</TableHead>
              <TableHead>{t("startsOn")}</TableHead>
              <TableHead>{t("endsOn")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link href={`/admin/series/${s.id}`} className="underline">
                    {s.userName ?? s.userEmail}
                  </Link>
                </TableCell>
                <TableCell>{s.siteName}</TableCell>
                <TableCell>{s.roomNumber}</TableCell>
                <TableCell>{tw(String(s.weekday))}</TableCell>
                <TableCell>{t(s.intervalWeeks === 2 ? "everyTwoWeeks" : "everyWeek")}</TableCell>
                <TableCell dir="ltr" className="text-start">
                  {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                </TableCell>
                <TableCell dir="ltr" className="text-start">
                  {s.startsOn}
                </TableCell>
                <TableCell dir="ltr" className="text-start">
                  {s.endsOn}
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{t(`status${s.status}`)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminShell>
  );
}
